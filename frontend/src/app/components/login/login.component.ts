// src/app/components/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isSubmitted = false;
  isLoading = false;

  // Pop-up state
  showPopup = false;
  popupType: 'success' | 'error' = 'success';
  popupMessage = '';
  popupTitle = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.pattern('^[0-9]+$')]],
      password: ['', [Validators.required]],
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  onSubmit(): void {
    this.isSubmitted = true;
    if (this.loginForm.invalid) return;

    this.isLoading = true;

    const body = {
      username: this.loginForm.value.username,
      password: this.loginForm.value.password,
    };

    this.http
      .post<any>('http://localhost:8000/login', body, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
      })
      .subscribe({
        next: (response) => {
          this.authService.login(
            response.access_token,
            response.role,
            this.loginForm.value.username
          );

          this.showSuccessPopup('Login Successful!', 'Redirecting to your dashboard...');
          
          setTimeout(() => {
            if (response.role === 'manager') {
              this.router.navigate(['/manager-dashboard']);
            } else if (response.role === 'employee') {
              this.router.navigate(['/engineer-dashboard']);
            } else {
              this.showErrorPopup('Login Failed', 'Unknown role received.');
            }
          }, 1500); // Wait for the pop-up to be seen
          
          this.isLoading = false;
        },
        error: (err) => {
          this.showErrorPopup('Login Failed', err.error?.detail || 'Login failed. Please try again.');
          this.isLoading = false;
        },
      });
  }

  showSuccessPopup(title: string, message: string): void {
    this.popupType = 'success';
    this.popupTitle = title;
    this.popupMessage = message;
    this.showPopup = true;
  }

  showErrorPopup(title: string, message: string): void {
    this.popupType = 'error';
    this.popupTitle = title;
    this.popupMessage = message;
    this.showPopup = true;
  }

  closePopup(): void {
    this.showPopup = false;
  }
}