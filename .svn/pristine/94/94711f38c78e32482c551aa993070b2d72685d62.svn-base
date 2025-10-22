// src/app/models/competency.model.ts
export interface UserProfile {
    username: number;           
    employee_name: string | null;
    manager_name: string | null;
    role: 'manager' | 'employee';
    direct_reports: DirectReport[];
  }
export interface CompetencyBase {
    employee_empid: string;
    employee_name:  string;
    division:       string;
    role_specific_comp: string;
    competency:     string;
    skill:          string;
    current_expertise:  string;
    target_expertise: string;
  }
  
  export interface CompetencyCreate extends CompetencyBase {}
  
  export interface CompetencyUpdate extends CompetencyBase {
    id: number;
  }
  
  export interface CompetencyOut extends CompetencyBase {
    id: number;
  }
  
  export interface CompetenciesWithUser {
  user: UserProfile;
  competencies: CompetencyOut[];

  }

  export interface DirectReport {
  employee_empid: string;
  employee_name: string;
}
