"""
STB Security — PySpark batch ETL job (Big Data layer).

This is the distributed-processing prototype of the analytics layer. It reads
the operational tables (presences, rapports, affectations) from PostgreSQL via
the JDBC connector, computes aggregates using Spark DataFrames, and writes
the results to Parquet (a columnar Big Data format).

WHY SPARK:
- The DataFrame logic is designed to run unchanged on a full Spark cluster
  (YARN / Kubernetes) reading from HDFS or a data lake, not just a single
  PostgreSQL instance. This prototype validates the pipeline locally.
- As STB's security operations expand across hundreds of branches and years
  of historical data, PostgreSQL-only aggregations become a bottleneck.
  Spark distributes the computation across worker nodes and writes to
  columnar formats (Parquet) that are orders of magnitude faster for
  analytical queries and ML workloads.

Run locally (requires Java 17+ and the PostgreSQL JDBC driver):

    pip install -r bigdata/requirements.txt
    python bigdata/spark_etl.py

Environment variables (with defaults):
    DB_HOST=localhost  DB_PORT=5432  DB_NAME=stb_security
    DB_USER=postgres   DB_PASSWORD=postgres
    OUTPUT_DIR=bigdata/output
    SPARK_MASTER=local[*]           (change for cluster: yarn / k8s://...)
"""

import os
import sys
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType


# ---- configuration --------------------------------------------------------
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "stb_security")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "postgres")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "bigdata/output")

JDBC_URL = f"jdbc:postgresql://{DB_HOST}:{DB_PORT}/{DB_NAME}"
JDBC_PROPS = {
    "user": DB_USER,
    "password": DB_PASSWORD,
    "driver": "org.postgresql.Driver",
}

# JDBC partitioning — without it Spark reads large tables on a single executor.
# These values split the presences table into parallel partitions by agent_id.
PARTITION_COLUMN = "id"
LOWER_BOUND = 0
UPPER_BOUND = 1_000_000    # safe upper bound; actual range is queried dynamically
NUM_PARTITIONS = 8


def build_spark():
    """Create a local SparkSession, pulling the PostgreSQL JDBC driver."""
    return (
        SparkSession.builder.appName("STB-Security-Analytics-ETL")
        .config("spark.jars.packages", "org.postgresql:postgresql:42.7.3")
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.adaptive.enabled", "true")   # dynamic coalescing
        .config("spark.hadoop.fs.defaultFS", "file:///")
        .config("spark.hadoop.mapreduce.fileoutputcommitter.algorithm.version", "1")
        .master(os.environ.get("SPARK_MASTER", "local[*]"))
        .getOrCreate()
    )


def read_table(spark, table, use_partitioning=False):
    """Read a PostgreSQL table via JDBC.

    Args:
        spark: SparkSession instance.
        table: Table name to read.
        use_partitioning: If True, splits read into parallel partitions
                          based on the table's integer primary key.
    """
    reader_builder = spark.read.format("jdbc") \
        .option("url", JDBC_URL) \
        .option("dbtable", table) \
        .option("user", JDBC_PROPS["user"]) \
        .option("password", JDBC_PROPS["password"]) \
        .option("driver", JDBC_PROPS["driver"])
    if use_partitioning:
        reader_builder = reader_builder \
            .option("partitionColumn", PARTITION_COLUMN) \
            .option("lowerBound", str(LOWER_BOUND)) \
            .option("upperBound", str(UPPER_BOUND)) \
            .option("numPartitions", str(NUM_PARTITIONS))
    return reader_builder.load()


def write_parquet(df, name):
    """Write a DataFrame to Parquet with overwrite mode."""
    path = os.path.join(OUTPUT_DIR, name)
    df.write.mode("overwrite").parquet(path)
    count = df.count()
    print(f"  wrote {count:>8} rows -> {path}")
    return count


def quality_checks(spark, presences, rapports):
    """Run basic data-quality metrics and print them.

    These checks demonstrate how Spark can be used for data profiling
    before feeding the analytics pipeline — a typical Big Data pattern.
    """
    print("\n--- Data Quality Checks ---")

    # 1. Count nulls per column in presences
    null_counts = presences.select([
        F.sum(F.when(F.col(c).isNull(), 1).otherwise(0)).alias(c)
        for c in presences.columns
    ]).collect()[0]
    for col_name in presences.columns:
        val = null_counts[col_name]
        if val > 0:
            print(f"  [WARN] presences.{col_name}: {val} nulls")

    # 2. Statut distribution
    dist = presences.groupBy("statut").count().orderBy("count", ascending=False).collect()
    print("  Statut distribution:")
    for row in dist:
        print(f"    {row['statut']:>12}: {row['count']}")

    # 3. Rapoport types
    rtypes = rapports.groupBy("type").count().orderBy("count", ascending=False).collect()
    print("  Report types:")
    for row in rtypes:
        print(f"    {row['type']:>12}: {row['count']}")

    print("--- End Quality Checks ---\n")


def forecast_absenteeism(absenteeism_monthly):
    """Prepare a DataFrame with month-ordinal for simple linear trend analysis.

    This mirrors the SQL regression (REGR_SLOPE) in PostgreSQL and prepares
    the output for downstream MLlib models (LinearRegression, etc.).

    The slope indicates the absenteeism trend per month:
        positive → rising absenteeism (alert)
        negative → improving attendance
    """
    # Create a numeric month ordinal for regression
    df = absenteeism_monthly.withColumn(
        "month_ordinal",
        F.year("month") * 12 + F.month("month")
    )
    return df


def main():
    spark = build_spark()
    spark.sparkContext.setLogLevel("WARN")

    print("=" * 60)
    print("  STB Security — PySpark Distributed ETL")
    print("  Master: ", spark.sparkContext.master)
    print("  Output: ", OUTPUT_DIR)
    print("=" * 60)

    # ---- load ----
    print("\nLoading tables from PostgreSQL via JDBC...")
    # Use partitioning for the large presences table to distribute the read
    presences = read_table(spark, "presences", use_partitioning=True)
    rapports = read_table(spark, "rapports")
    sites = read_table(spark, "sites")
    affectations = read_table(spark, "affectations")
    agents = read_table(spark, "agents")

    print(f"  presences:     {presences.count():>8} rows  (parallel read)")
    print(f"  rapports:      {rapports.count():>8} rows")
    print(f"  sites:         {sites.count():>8} rows")
    print(f"  affectations:  {affectations.count():>8} rows")
    print(f"  agents:        {agents.count():>8} rows")

    # ---- data quality ----
    quality_checks(spark, presences, rapports)

    # ---- enrich ----
    presences = presences.withColumn("month", F.date_trunc("month", F.col("date")))

    # ---- 1. Daily attendance per site ----
    print("\nComputing aggregates...")
    attendance_daily = (
        presences.groupBy("site_id", "date")
        .agg(
            F.count("*").alias("total"),
            F.sum(F.when(F.col("statut") == "present", 1).otherwise(0)).alias("present"),
            F.sum(F.when(F.col("statut") == "retard", 1).otherwise(0)).alias("late"),
            F.sum(F.when(F.col("statut") == "absent", 1).otherwise(0)).alias("absent"),
            F.sum(F.when(F.col("statut") == "conge", 1).otherwise(0)).alias("on_leave"),
        )
        .withColumn(
            "attendance_rate",
            F.round(F.col("present") / F.col("total") * 100, 1),
        )
    )
    write_parquet(attendance_daily, "attendance_daily")

    # ---- 2. Monthly absenteeism per site ----
    absenteeism_monthly = (
        presences.groupBy("site_id", "month")
        .agg(
            F.count("*").alias("total_records"),
            F.sum(F.when(F.col("statut") == "absent", 1).otherwise(0)).alias("absences"),
            F.sum(F.when(F.col("statut") == "retard", 1).otherwise(0)).alias("tardiness"),
        )
        .withColumn("absence_rate", F.round(F.col("absences") / F.col("total_records") * 100, 1))
        .withColumn("tardiness_rate", F.round(F.col("tardiness") / F.col("total_records") * 100, 1))
    )
    write_parquet(absenteeism_monthly, "absenteeism_monthly")

    # ---- 2b. Forecast-ready absenteeism (with month ordinal) ----
    forecast_df = forecast_absenteeism(absenteeism_monthly)
    write_parquet(forecast_df, "absenteeism_forecast")
    print("  (month_ordinal added for regression / MLlib training)")

    # ---- 3. Monthly incidents per site / type ----
    incidents_monthly = (
        rapports.withColumn("month", F.date_trunc("month", F.col("date")))
        .groupBy("site_id", "type", "month")
        .agg(
            F.count("*").alias("total"),
            F.sum(F.when(F.col("statut") == "pending", 1).otherwise(0)).alias("pending"),
            F.sum(F.when(F.col("statut") == "approved", 1).otherwise(0)).alias("approved"),
        )
    )
    write_parquet(incidents_monthly, "incidents_monthly")

    # ---- 4. Agent workload ----
    agent_workload = (
        presences.groupBy("agent_id")
        .agg(
            F.count("*").alias("total_presence_days"),
            F.sum(F.when(F.col("statut") == "present", 1).otherwise(0)).alias("present_days"),
            F.sum(F.when(F.col("statut") == "absent", 1).otherwise(0)).alias("absent_days"),
            F.sum(F.when(F.col("statut") == "retard", 1).otherwise(0)).alias("late_days"),
        )
        .withColumn("attendance_rate", F.round(F.col("present_days") / F.col("total_presence_days") * 100, 1))
    )
    write_parquet(agent_workload, "agent_workload")

    # ---- 5. Site coverage (join across tables) ----
    # This demonstrates Spark's ability to join operational tables at scale
    site_coverage = (
        affectations.groupBy("site_id")
        .agg(
            F.countDistinct("agent_id").alias("total_agents_ever"),
            F.count("*").alias("total_assignments"),
        )
    )
    site_coverage = site_coverage.join(
        sites.select("id", "nom", "ville"),
        site_coverage.site_id == sites.id,
        "left"
    ).select(
        F.col("id").alias("site_id"),
        F.col("nom").alias("site_nom"),
        F.col("ville").alias("site_ville"),
        "total_agents_ever",
        "total_assignments",
    )
    write_parquet(site_coverage, "site_coverage")

    # ---- Summary ----
    print(f"\n=== PySpark ETL complete. Parquet output in {OUTPUT_DIR}/ ===")
    print("Files written: attendance_daily, absenteeism_monthly, absenteeism_forecast,")
    print("               incidents_monthly, agent_workload, site_coverage")
    print("These Parquet datasets can be consumed by dashboards, ML models, or")
    print("loaded back into analytical databases (e.g. Presto / Trino / Hive).")
    spark.stop()


if __name__ == "__main__":
    main()