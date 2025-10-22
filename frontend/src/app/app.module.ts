import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { NavbarComponent } from './components/navbar/navbar.component';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AboutComponent } from './components/about/about.component';
import { EngineerDashboardComponent } from './dashboards/engineer-dashboard/engineer-dashboard.component';
import { ManagerDashboardComponent } from './dashboards/manager-dashboard/manager-dashboard.component';
import { SkillFilterPipe } from './pipes/skill-filter.pipe';
import { DirectivesDirective } from './directives.directive';
import { ToastComponent } from './components/toast/toast.component';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    HomeComponent,
    LoginComponent,
    RegisterComponent,
    AboutComponent,
    EngineerDashboardComponent,
    ManagerDashboardComponent,
    SkillFilterPipe,
    DirectivesDirective,
    ToastComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppRoutingModule,
    CommonModule,
    BrowserAnimationsModule,
    MatSnackBarModule,
    BrowserAnimationsModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
