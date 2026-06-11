@echo off
set JAVA_HOME=C:\Users\client\Desktop\java17\jdk-17.0.12+7
set HADOOP_HOME=C:\Users\client\Desktop\hadoop
set PATH=%JAVA_HOME%\bin;%HADOOP_HOME%\bin;%PATH%
set PYSPARK_PYTHON=C:\Python314\python.exe
set DB_PASSWORD=soltqn
set SPARK_HOME=C:\Users\client\AppData\Roaming\Python\Python314\site-packages\pyspark
cd /d C:\Users\client\Desktop\pfe-devin-1780746378-bigdata-layer-master\pfe-devin-1780746378-bigdata-layer-master\bigdata
echo JAVA_HOME=%JAVA_HOME%
echo HADOOP_HOME=%HADOOP_HOME%
echo DB_PASSWORD=%DB_PASSWORD%
echo Checking Java...
"%JAVA_HOME%\bin\java" -version
echo.
echo Running PySpark ETL...
"%PYSPARK_PYTHON%" spark_etl.py
