import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AffectationsService } from '../../../services/affectations';
import { AgentsService } from '../../../services/agents';
import { SitesService } from '../../../services/sites';
import { AuthService } from '../../../services/auth';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-affectation-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './affectation-list.html',
  styleUrls: ['./affectation-list.css']
})
export class AffectationListComponent implements OnInit {
  affectations: any[] = [];
  agents: any[] = [];
  sites: any[] = [];
  loading = true;
  showForm = false;
  editMode = false;
  editingId: number | null = null;
  error = '';
  form: FormGroup;
  user: any = null;
  searchQuery = '';
  get filteredAffectations(): any[] {
    if (!this.searchQuery) return this.affectations;
    const q = this.searchQuery.toLowerCase();
    return this.affectations.filter(af =>
      (af.agent_nom && af.agent_nom.toLowerCase().includes(q)) ||
      (af.site_nom && af.site_nom.toLowerCase().includes(q))
    );
  }

  constructor(
    private affSvc: AffectationsService,
    private agSvc: AgentsService,
    private siteSvc: SitesService,
    private auth: AuthService,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      agent_id: ['', Validators.required],
      site_id: ['', Validators.required],
      date_debut: ['', Validators.required],
      duree: [''],
      date_fin: ['']
    });
  }

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.loadAll();
      this.cdr.detectChanges();
    });
  }

  loadAll() {
    this.loading = true;
    const affRequest = this.isAgent()
      ? this.http.get<any[]>(`${environment.apiUrl}/affectations/mes-affectations`)
      : this.affSvc.getAll();
    affRequest.subscribe({
      next: list => { this.affectations = list || []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
    this.agSvc.getAll().subscribe({
      next: list => { this.agents = list || []; this.cdr.detectChanges(); },
      error: () => this.cdr.detectChanges()
    });
    this.siteSvc.getAll().subscribe({
      next: list => { this.sites = list || []; this.cdr.detectChanges(); },
      error: () => this.cdr.detectChanges()
    });
  }

  onDurationChange() {
    const { duree, date_debut } = this.form.value;
    if (!duree || !date_debut) return;
    const end = new Date(date_debut);
    end.setMonth(end.getMonth() + parseInt(duree, 10));
    this.form.patchValue({ date_fin: end.toISOString().slice(0, 10) });
  }

  openCreate() {
    this.editMode = false;
    this.editingId = null;
    this.form.reset();
    this.error = '';
    this.showForm = true;
  }

  openEdit(af: any) {
    this.editMode = true;
    this.editingId = af.id;
    this.error = '';
    this.form.patchValue({
      agent_id: af.agent_id,
      site_id: af.site_id,
      date_debut: af.date_debut ? String(af.date_debut).slice(0, 10) : '',
      date_fin: af.date_fin ? String(af.date_fin).slice(0, 10) : '',
      duree: ''
    });
    this.showForm = true;
  }

  cancelForm() {
    this.showForm = false;
    this.editMode = false;
    this.editingId = null;
    this.form.reset();
    this.error = '';
  }

  submit() {
    if (this.form.invalid) return;
    const payload: any = {
      agent_id: this.form.value.agent_id,
      site_id: this.form.value.site_id,
      date_debut: this.form.value.date_debut
    };
    if (this.form.value.date_fin) payload.date_fin = this.form.value.date_fin;

    if (this.editMode && this.editingId != null) {
      this.affSvc.update(this.editingId, payload).subscribe({
        next: () => { this.loadAll(); this.cancelForm(); },
        error: (e) => { this.error = e.error?.error || 'Error'; }
      });
    } else {
      this.affSvc.create(payload).subscribe({
        next: () => { this.loadAll(); this.cancelForm(); },
        error: (e) => { this.error = e.error?.error || 'Error'; }
      });
    }
  }

  delete(id: number) {
    if (!confirm('Delete this assignment?')) return;
    this.affSvc.delete(id).subscribe({ next: () => this.loadAll() });
  }

  isAgent(): boolean { return this.user?.role === 'agent'; }
  isChef(): boolean { return this.user?.role === 'chef_equipe'; }
  isAdmin(): boolean { return this.user?.role === 'admin'; }
  canCreate(): boolean { return this.isChef() || this.isAdmin(); }
  canEdit(): boolean { return this.isChef() || this.isAdmin(); }
  canDelete(): boolean { return this.isChef() || this.isAdmin(); }
}
