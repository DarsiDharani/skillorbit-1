import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor() {}

  // Updated login method to use consistent keys
  login(token: string, role: string, username: string) {
    localStorage.setItem('access_token', token); // Use 'access_token'
    localStorage.setItem('user_role', role);     // Use 'user_role'
    localStorage.setItem('username', username);  // Use 'username'
  }

  logout() {
    localStorage.clear(); // Clears all items
  }

  isLoggedIn(): boolean {
    return !!this.getToken(); // Checks if a token exists
  }

  getRole(): string | null {
    return localStorage.getItem('user_role'); // Retrieve 'user_role'
  }

  getEmpId(): string | null {
    // If you're using 'username' as empId, you can return that
    return localStorage.getItem('username');
  }

  // New method to get the username
  getUsername(): string | null {
    return localStorage.getItem('username');
  }

  // New method to get the token
  getToken(): string | null {
    return localStorage.getItem('access_token');
  }
}