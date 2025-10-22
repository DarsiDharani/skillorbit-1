// src/app/components/register/register.component.ts

import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  isSubmitted = false;

  // Popup state
  showPopup = false;
  popupType: 'success' | 'error' = 'success';
  popupMessage = '';
  popupTitle = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group(
      {
        emp_id: ['', [Validators.required, Validators.pattern('^[0-9]{7}$')]],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$'),
          ],
        ],
        confirm_password: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  passwordMatchValidator(form: AbstractControl): ValidationErrors | null {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirm_password')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  onSubmit(): void {
    this.isSubmitted = true;
    if (this.registerForm.invalid) {
      console.warn('❌ Invalid form:', this.registerForm);
      // --- NEW DEBUGGING LOGS ---
      console.log('Form Status:', this.registerForm.status);
      Object.keys(this.registerForm.controls).forEach(key => {
        const controlErrors = this.registerForm.get(key)?.errors;
        if (controlErrors != null) {
          console.log(`Control: ${key}, Errors:`, controlErrors);
        }
      });
      if (this.registerForm.errors) {
        console.log('Form-level errors:', this.registerForm.errors);
      }
      // --------------------------
      return;
    }

    // Corrected payload: remove confirm_password as the backend doesn't need it
    const registerData = {
      emp_id: this.registerForm.get('emp_id')?.value,
      password: this.registerForm.get('password')?.value,
    };

    this.http.post<any>('http://localhost:8000/register', registerData).subscribe({
      next: () => {
        this.showSuccessPopup('Registration Successful!', 'Your account has been created successfully. Please login to continue.');
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err: HttpErrorResponse) => {
        console.error('❌ Registration API error:', err);
        this.showErrorPopup('Registration Failed', err.error.detail || 'Registration failed. Please try again.');
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