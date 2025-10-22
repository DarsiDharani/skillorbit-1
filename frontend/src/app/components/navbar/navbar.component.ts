import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service'; // <-- IMPORTANT: Adjust this path if needed

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  isMenuOpen = false;

  constructor(
    public router: Router,
    private authService: AuthService // Inject AuthService here
  ) {}

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  /**
   * Checks if the user is logged in by calling the method from your AuthService.
   * @returns boolean
   */
  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  /**
   * Logs the user out and navigates to the login page.
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
    this.isMenuOpen = false; // Optional: close mobile menu on logout
  }
}