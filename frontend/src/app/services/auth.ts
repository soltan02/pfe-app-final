// Auth state + token storage. Subscribed to via currentUser$.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser$ = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private router: Router) {
    // On app load, decode the token to seed currentUser$ so the navbar renders
    // immediately, then fire fetchMe() to get the full profile (including
    // avatar_url, telephone, etc.) and merge it in.
    const token = this.getToken();
    if (token) {
      const decoded = this.decodeToken(token);
      if (decoded) {
        this.currentUser$.next(decoded);
        // Immediately fetch the full profile so avatar_url etc. is in place
        // before any other component subscribes.
        this.fetchMe();
      }
    }
  }

  login(email: string, password: string) {
    return this.http.post(`${environment.apiUrl}/auth/login`, { email, password });
  }

  // full profile fetch (nom, telephone, agent_id, avatar_url, ...)
  // Merges with the existing user so we don't lose fields like `id` or `role`
  // that the JWT decode provided at boot.
  fetchMe() {
    this.http.get(`${environment.apiUrl}/auth/me`).subscribe({
      next: (u: any) => {
        const current = this.currentUser$.value || {};
        this.currentUser$.next({ ...current, ...u });
      },
      error: (e) => {
        console.error('fetchMe error:', e);
      }
    });
  }

  saveToken(t: string) { localStorage.setItem('token', t); }
  getToken() { return localStorage.getItem('token'); }

  logout() {
    localStorage.removeItem('token');
    this.currentUser$.next(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn() { return !!this.getToken(); }

  // payload only (header.payload.signature)
  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return { id: payload.id, email: payload.email, role: payload.role };
    } catch {
      return null;
    }
  }
}