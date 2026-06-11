 // Root component: sidebar + router outlet.
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div class="app-shell">
      <app-navbar></app-navbar>
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      min-height: 100vh;
      background: #0a0e1a;
    }
    .app-main {
      flex: 1;
      min-width: 0;
      overflow-x: hidden;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'frontend';
  constructor(private auth: AuthService) {}
  ngOnInit() {
    if (this.auth.getToken()) {
      this.auth.fetchMe();
    }
  }
}
