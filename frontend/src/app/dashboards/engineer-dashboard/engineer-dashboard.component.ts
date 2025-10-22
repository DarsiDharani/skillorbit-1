import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { trigger, style, animate, transition, query, stagger } from '@angular/animations';
import { ToastService, ToastMessage } from '../../services/toast.service';


export interface Skill {
  id: number;
  skill: string;
  competency: string;
  current_expertise: string;
  target_expertise: string;
  status: 'Met' | 'Gap' | 'Error';
}

export interface ModalSkill {
  id: number;
  skill: string;
  competency: string;
  current_expertise?: string;
  target_expertise?: string;
  status?: 'Met' | 'Gap' | 'Error';
}

export interface TrainingDetail {
  id: number;
  division?: string;
  department?: string;
  competency?: string;
  skill?: string;
  training_name: string;
  training_topics?: string;
  prerequisites?: string;
  skill_category?: string;
  trainer_name: string;
  email?: string;
  training_date?: string;
  duration?: string;
  time?: string;
  training_type?: string;
  seats?: string;
  assessment_details?: string;
  assignmentType?: 'personal' | 'team'; // Added to distinguish between personal and team assignments
}

export interface TrainingRequest {
  id: number;
  training_id: number;
  employee_empid: string;
  manager_empid: string;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected';
  manager_notes?: string;
  response_date?: string;
  training: TrainingDetail;
}

// --- NEW, MORE DETAILED INTERFACES FOR ASSIGNMENTS ---
export interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

export interface AssignmentQuestion {
  text: string;
  helperText: string; // Optional helper text like "Please select at most 2 options."
  type: 'single-choice' | 'multiple-choice' | 'text-input';
  options: QuestionOption[];
}

export interface Assignment {
  trainingId: number | null;
  title: string;
  description: string;
  questions: AssignmentQuestion[];
}


export interface FeedbackQuestion {
    text: string;
    options: string[];
    isDefault: boolean;
}

export interface CalendarEvent {
  date: Date;
  title: string;
  trainer: string;
}

type LevelBlock = { level: number; items: string[] };
type Section = { title: string; subtitle?: string; levels: LevelBlock[] };

@Component({
  selector: 'app-engineer-dashboard',
  templateUrl: './engineer-dashboard.component.html',
  styleUrls: ['./engineer-dashboard.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('500ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('500ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideFadeIn', [
        transition(':enter', [
            style({ opacity: 0, transform: 'translateY(-20px)' }),
            animate('500ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
        ]),
        transition(':leave', [
            animate('500ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' }))
        ])
    ]),
    trigger('modalScale', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ]),
    trigger('listStagger', [
      transition('* <=> *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger('120ms', animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })))
        ], { optional: true })
      ])
    ]),
    trigger('bouncyScale', [
      transition(':enter', [
        style({ transform: 'scale(0.5)', opacity: 0 }),
        animate('700ms cubic-bezier(0.68, -0.55, 0.27, 1.55)', style({ transform: 'scale(1)', opacity: 1 }))
      ])
    ])
  ]
})
export class EngineerDashboardComponent implements OnInit {
  // --- Component State & Filters ---
  skillSearch: string = '';
  skillStatusFilter: string = '';
  skillNameFilter: string = '';
  skillNames: string[] = [];
  userName: string = '';
  employeeId: string = '';
  employeeName: string = '';
  skills: Skill[] = [];
  skillGaps: Skill[] = [];
  totalSkills: number = 0;
  skillsMet: number = 0;
  skillsGap: number = 0;
  progressPercentage: number = 0;
  isLoading: boolean = true;
  errorMessage: string = '';
  activeTab: string = 'dashboard';

  // --- Skills Modal State ---
  showSkillsModal: boolean = false;
  modalTitle: string = '';
  modalSkills: ModalSkill[] = [];

  // --- Additional (Self-Reported) Skills ---
  additionalSkills: any[] = [];
  newSkill = {
    name: '',
    level: 'Beginner',
    category: 'Technical',
    description: ''
  };
  showAddSkillForm: boolean = false;
  editingSkillId: number | null = null;
  skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
  skillCategories = ['Technical', 'Soft Skills', 'Leadership', 'Communication', 'Project Management', 'Other'];
  skillCategoryLevels: string[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

  // --- Levels Definitions ---
  levelsSearch = '';
  selectedSkill = '';
  public expandedLevels = new Set<string>();
  public expandedSkill: string | null = null; // <<< NEW PROPERTY FOR ACCORDION
  levelHeaders = [
    { num: 1, title: 'Beginner' },
    { num: 2, title: 'Basic' },
    { num: 3, title: 'Intermediate' },
    { num: 4, title: 'Advanced' },
    { num: 5, title: 'Expert' }
  ];


  // --- Trainings & Catalog ---
  allTrainings: TrainingDetail[] = [];
  assignedTrainings: TrainingDetail[] = [];
  dashboardUpcomingTrainings: TrainingDetail[] = [];
  trainingRequests: TrainingRequest[] = [];
  trainingSearch: string = '';
  trainingSkillFilter: string = 'All';
  trainingLevelFilter: string = 'All';
  trainingDateFilter: string = '';
  trainingCatalogView: 'list' | 'calendar' = 'list';

  // --- Assigned Trainings Filters ---
  assignedSearch: string = '';
  assignedSkillFilter: string = 'All';
  assignedLevelFilter: string = 'All';
  assignedDateFilter: string = '';
  assignedTrainingsView: 'list' | 'calendar' = 'list';

  // --- Calendar & Dashboard Metrics ---
  allTrainingsCalendarEvents: CalendarEvent[] = [];
  assignedTrainingsCalendarEvents: CalendarEvent[] = [];
  badges: Skill[] = [];
  upcomingTrainingsCount: number = 0;
  nextTrainingTitle: string = '';
  currentDate: Date = new Date();
  calendarDays: (Date | null)[] = [];
  calendarMonth: string = '';
  calendarYear: number = 2025;

  // --- Trainer Zone ---
  isTrainer: boolean = false;
  trainerZoneView: 'overview' | 'assignmentForm' | 'feedbackForm' = 'overview';
  showScheduleTrainingModal: boolean = false;
  newTraining = {
    division: '',
    department: '',
    competency: '',
    skill: '',
    training_name: '',
    training_topics: '',
    prerequisites: '',
    skill_category: 'L1',
    trainer_name: '',
    email: '',
    training_date: '',
    duration: '',
    time: '',
    training_type: 'Online',
    seats: '',
    assessment_details: ''
  };
  newAssignment: Assignment = {
    trainingId: null,
    title: '',
    description: '',
    questions: []
  };
  defaultFeedbackQuestions: FeedbackQuestion[] = [
    { text: "How would you rate your overall experience with this training?", options: ['Excellent', 'Good', 'Average', 'Fair', 'Poor'], isDefault: true },
    { text: "Was the content relevant and applicable to your role?", options: ['Yes', 'No', 'Partially'], isDefault: true },
    { text: "Was the material presented in a clear and understandable way?", options: ['Yes', 'No', 'Somewhat'], isDefault: true },
    { text: "Did the training meet your expectations?", options: ['Yes', 'No', 'Partially'], isDefault: true },
    { text: "Was the depth of the content appropriate?", options: ['Appropriate', 'Too basic', 'Too advanced'], isDefault: true },
    { text: "Was the trainer able to explain concepts clearly?", options: ['Yes', 'No', 'Somewhat'], isDefault: true },
    { text: "Did the trainer engage participants effectively?", options: ['Yes', 'No', 'Somewhat'], isDefault: true },
    { text: "Will this training improve your day-to-day job performance?", options: ['Yes', 'No', 'Maybe'], isDefault: true },
    { text: "Was the pace of the training comfortable?", options: ['Comfortable', 'Too fast', 'Too slow'], isDefault: true },
    { text: "Were the training materials/resources useful?", options: ['Yes', 'No', 'Somewhat'], isDefault: true }
  ];
  newFeedback = {
    trainingId: null as number | null,
    customQuestions: [] as FeedbackQuestion[]
  };

  // --- Static Data ---
  sections: Section[] = [
    {
      title: 'EXAM',
      levels: [
        { level: 1, items: ['Launch EXAM', 'Test execution', 'Exporting reports'] },
        { level: 2, items: ['Implement test cases', 'Create collections', 'EXAM configuration', 'DOORS synchronization'] },
        { level: 3, items: ['Create short names', 'NeKeDa reporting', 'Debugging in EXAM'] },
        { level: 4, items: ['Implement libraries & common sequences', 'Know-how on libraries (1–4)', 'Create baselines', 'Release configuration', 'Update variable mapping', 'System configurations'] },
        { level: 5, items: ['EXAM administration', 'Model domain configuration', 'Set up new project', 'Groovy scripting'] }
      ]
    },
    {
      title: 'Softcar',
      levels: [
        { level: 1, items: ['Launch Softcar', 'Artifacts in Softcar'] },
        { level: 2, items: ['Blockboard & calibration variables', 'Add A2L variables', 'Logging'] },
        { level: 3, items: ['Debugging', 'Error simulation', 'CAN message error simulations', 'Script execution in Softcar'] },
        { level: 4, items: ['Create layouts', 'Trigger files', 'Startup script', 'Softcar scripting'] },
        { level: 5, items: ['Plant model creation', 'CAN configuration', 'DLL files'] }
      ]
    },
    {
      title: 'Python',
      subtitle: 'Foundational → application automation',
      levels: [
        { level: 1, items: ['Install packages', 'Syntax, data types, operators', 'Reserved keywords', 'Input/Output'] },
        { level: 2, items: ['Loops (for/while)', 'try/except', 'Strings', 'Lists/Dict/Sets methods', 'break/continue'] },
        { level: 3, items: ['Functions (incl. lambda, *args/**kwargs)', 'File handling', 'List comprehensions', 'Intro to classes & objects'] },
        { level: 4, items: ['Inheritance, encapsulation, polymorphism', 'Static/class methods', 'json', 'pip packages', 'Debugging with pdb & argparse'] },
        { level: 5, items: ['API requests', 'App development', 'Task automation with libs', 'Decorators & generators', 'Excel data ops, pickling'] }
      ]
    },
    {
      title: 'C++ (CPP)',
      subtitle: 'Skill matrix by domain',
      levels: [
        { level: 1, items: ['Core language: variables, loops, conditionals, functions', 'Memory: stack, basic pointers', 'OOP/Templates: basic class/struct, simple encapsulation', 'Std libs: I/O streams, arrays', 'Concurrency: none/very basic', 'HW interaction: none', 'Build: single-file or simple compile', 'Debugging: print-based', 'Architecture: simple procedural'] },
        { level: 2, items: ['Core: classes, inheritance, function overloading', 'Memory: dynamic allocation, manual new/delete', 'OOP: full OOP, virtual functions, basic templates', 'Std libs: STL containers, iterators, namespaces', 'Concurrency: std::thread, mutexes, condition variables, basics', 'HW: UART/SPI/I2C basics, polling/interrupt basics', 'Build: CMake/make projects', 'Debugging: IDE debuggers, tracing', 'Architecture: modular design, class hierarchies'] },
        { level: 3, items: ['Core: smart pointers, templates, lambda, move semantics', 'Memory: unique/shared pointers, RAII', 'OOP: template classes, function templates, partial specialization', 'Std libs: STL algorithms, functional (bind, function), C++17/20 features', 'Concurrency: thread pools, atomics, lock-free queues', 'HW: protocol stacks, parsing/filtering sensor data, bootloader integration', 'Build: cross-compilation, linker script editing, startup code', 'Debugging: HW breakpoints, test-driven development', 'Architecture: HAL & layered driver-service-app'] },
        { level: 4, items: ['Core: advanced metaprogramming, constexpr, concepts, compile-time programming', 'Memory: custom allocators, memory pools, cache-aware structures, linker scripts', 'OOP: CRTP, SFINAE, concepts, policy-based design', 'Std libs: custom allocators/customization, deep C++20/23 (coroutines, ranges)', 'Concurrency: RTOS integration, scheduling, context switching, real-time tuning', 'HW: firmware architecture, power optimization, watchdogs, interrupt prioritization', 'Build: advanced CMake, memory maps, flash/ROM segmentation, compiler flags', 'Debugging: JTAG/SWD, oscilloscopes, profilers, automated pipelines', 'Architecture: full firmware, distributed systems, safety compliance (MISRA/ISO 26262)'] }
      ]
    },
    {
      title: 'Axivion',
      levels: [
        { level: 1, items: ['Batch run', 'Review reports', 'Fix issues'] },
        { level: 2, items: ['Tool configuration', 'Refine issues (false positives, severity, incremental analysis, trace bugs)'] },
        { level: 3, items: ['Define architecture model (layered, client-server)', 'Verify dependencies', 'Detect cycles/layer violations/illegal access', 'Issue baselines to isolate new violations'] },
        { level: 4, items: ['CI/CD report generation (Git/Jenkins)', 'Compliance (MISRA/AUTOSAR/ISO26262 traceability)'] },
        { level: 5, items: ['Scripting: custom rules (naming, complexity limits)', 'Combine with other tools'] }
      ]
    },
    {
      title: 'MATLAB',
      levels: [
        { level: 1, items: ['Launch MATLAB'] },
        { level: 2, items: ['Configuration & inputs', 'Variable handling', 'Execution'] },
        { level: 3, items: ['Debugging (Simulink)', 'Error simulation', 'M-script execution'] },
        { level: 4, items: ['M-scripting', 'Stateflow debugging', 'Create S-Function'] },
        { level: 5, items: ['Library creation', 'Module implementation'] }
      ]
    },
    {
      title: 'DOORS',
      levels: [
        { level: 1, items: ['UI navigation (modules, views, folders)', 'Toolbar/menus/commands basics'] },
        { level: 2, items: ['Create/edit/manage requirements', 'Link requirements for traceability', 'Use attributes for categorize/filter'] },
        { level: 3, items: ['DB setup/maintenance', 'Import/export data', 'Manage users & permissions'] },
        { level: 4, items: ['Customize views/layouts', 'DXL scripting & automation', 'Reports for coverage/traceability'] },
        { level: 5, items: ['Built-in analysis for gaps/inconsistencies', 'Integrations (IBM Rational, MS Office, etc.)'] }
      ]
    },
    {
      title: 'Azure DevOps',
      levels: [
        { level: 1, items: ['Access & overview of Pipelines and advantages'] },
        { level: 2, items: ['Run pipelines', 'Dashboard analysis', 'Produced/consumed artifacts'] },
        { level: 3, items: ['Debug pipeline errors', 'Know Azure services: Boards, Repos, Pipeline Library'] },
        { level: 4, items: ['Agents, Pools, Stages, Jobs, Builds, Variables', 'Variable groups, PAT, Resources'] },
        { level: 5, items: ['Create pipelines with YAML', 'Full pipeline creation & Azure dashboard administration'] }
      ]
    },
    {
      title: 'Smart Git',
      levels: [
        { level: 1, items: ['Can open Smart Git and perform basic operations like viewing repositories and navigating the tool interface', 'Understand the concept of git version control', 'Can clone a repository', 'Basic knowledge of Git concepts (add, stage, stash, commit, fetch, push, pull) but lacks deeper understanding'] },
        { level: 2, items: ['Branch management', 'Comfortable using Smart Git for basic Git workflows like creating and switching branches, merging, and resolving simple merge conflicts', 'Should know about .git file configuration', 'Good Hands on Git operations (commit, push, fetch, pull, pull requests..etc)', 'Has a basic understanding of how Git works (branching, commits, merges)', 'Understands the concept of merge conflicts and can resolve them with some help', 'Able to know the changes in the commit history itself and understand differences between versions'] },
        { level: 3, items: ['Should expert in branch rebasing b/w multiple task branches or main branch.etc', 'Advanced features like rebase, cherry-pick, or interactive rebasing', 'Understands and can explain how Git handles data (how commits work, SHA-1 hashes, etc.)'] },
        { level: 4, items: ['Can diagnose and resolve issues that arise in project (e.g., complex merge conflicts, history rewrites, etc.)', 'Deep understanding of Git internals, workflows, and advanced features like Git hooks, submodules, and CI/CD integration'] },
        { level: 5, items: ['Expert at troubleshooting and fixing complex Git issues, including history rewrites, reflog, and rebasing across multiple branches', 'Can mentor others, guide teams in setting up version control, and resolve any version control-related conflicts'] }
      ]
    },
    {
      title: 'Integrity',
      levels: [
        { level: 1, items: ['Configuration of Tool', 'Changing status of tasks', 'Attaching reports', 'Updating fields properly'] },
        { level: 2, items: ['Creating filters', 'Creating change requests', 'Spawns to change request', 'Delivery, Build', 'Review checklist creation', 'Creating member links', 'Creating sandboxes'] },
        { level: 3, items: ['Check-in and checkout of documents', 'Performing reviews', 'Tracing changes from Integrity to Source code'] },
        { level: 4, items: ['Generating reports to track progress and identify issues', 'Customizing reports to meet specific stakeholder needs'] },
        { level: 5, items: ['Managing user roles and permissions to ensure secure collaboration', 'Integrating with other PTC products and third party tools like Jira and Microsoft Teams'] }
      ]
    }
  ];

  private readonly API_ENDPOINT = 'http://localhost:8000/data/engineer';

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.fetchDashboardData();
    this.fetchScheduledTrainings();
    this.fetchAssignedTrainings();
    this.fetchTrainingRequests();
  }

  // --- Calendar logic ---
  generateCalendar(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    this.calendarMonth = this.currentDate.toLocaleString('default', { month: 'long' });
    this.calendarYear = year;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();

    this.calendarDays = [];
    for (let i = 0; i < startDay; i++) {
      this.calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      this.calendarDays.push(new Date(year, month, i));
    }
  }

  previousMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateCalendar();
  }

  isToday(date: Date | null): boolean {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  getEventForDate(date: Date | null, events: CalendarEvent[]): CalendarEvent | undefined {
    if (!date) return undefined;
    return events.find(event =>
      event.date.getDate() === date.getDate() &&
      event.date.getMonth() === date.getMonth() &&
      event.date.getFullYear() === date.getFullYear()
    );
  }

  // --- Data Fetching & Processing ---
  fetchDashboardData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const token = this.authService.getToken();
    const userRole = this.authService.getRole();

    if (!token) {
      this.errorMessage = 'Authentication token not found. Please log in again.';
      this.isLoading = false;
      this.router.navigate(['/login']);
      return;
    }

    if (userRole !== 'employee') {
      this.errorMessage = `Invalid role: ${userRole}. Expected 'employee'.`;
      this.isLoading = false;
      return;
    }

    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any>(this.API_ENDPOINT, { headers }).pipe(
      map(response => {
        this.employeeId = response.username;
        this.employeeName = response.employee_name || 'Likhitha Pilli';
        this.userName = this.employeeName || this.employeeId;
        this.skills = response.skills;
        this.isTrainer = response.employee_is_trainer || false;
        if (this.skills && this.skills.length > 0) {
          this.skillNames = Array.from(new Set(this.skills.map(skill => skill.skill))).sort();
        }
        this.processDashboardData();
        this.loadAdditionalSkills();
        this.isLoading = false;
        return response;
      }),
      catchError(err => {
        if (err.status === 401) {
          this.errorMessage = 'Authentication failed. Session may have expired.';
          this.authService.logout();
          this.router.navigate(['/login']);
        } else {
          // Mock data for display purposes if API fails
          this.employeeName = 'Likhitha Pilli';
          this.userName = 'Likhitha Pilli';
          this.employeeId = 'user123';
          this.processDashboardData(); // Will use default values
          this.dashboardUpcomingTrainings = [{ id: 1, training_name: 'Advanced Python', training_date: '2025-10-15', time: '10:00 AM', trainer_name: 'Jane Doe', training_type: 'Online' }];
          this.errorMessage = `Failed to load live data. Displaying sample data.`;
        }
        this.isLoading = false;
        return of(null);
      })
    ).subscribe();
  }

  processDashboardData(): void {
    // Core Skills count is based on static sections (10 skills)
    this.totalSkills = this.sections.length;
    
    if (!this.skills || this.skills.length === 0) {
      // Use hardcoded defaults if API fails or returns no skills
      this.skillsMet = 3; // Default value for Skills Met
      this.skillsGap = 7; // Default value for Skills Gap
      this.progressPercentage = 30; // 3/10 = 30%
      this.skillGaps = [];
      this.badges = [];
      return;
    }

    // Skills Met count is based on API skills with status "Met"
    this.skillsMet = this.skills.filter(s => s.status === 'Met').length;
    this.skillsGap = this.skills.filter(s => s.status === 'Gap').length;
    this.progressPercentage = this.totalSkills > 0
      ? Math.round((this.skillsMet / this.totalSkills) * 100)
      : 0;

    this.skillGaps = this.skills.filter(s => s.status === 'Gap');
    this.badges = this.skills.filter(s => s.status === 'Met');
  }

  processDashboardTrainings(): void {
    if (!this.assignedTrainings || this.assignedTrainings.length === 0) {
        this.dashboardUpcomingTrainings = [];
        return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.dashboardUpcomingTrainings = this.assignedTrainings
        .filter(t => t.training_date && new Date(t.training_date) >= today)
        .sort((a, b) => {
            return new Date(a.training_date!).getTime() - new Date(b.training_date!).getTime();
        });
  }

  // --- Training Data & Filtering ---
  fetchScheduledTrainings(): void {
    const token = this.authService.getToken();
    if (!token) {
        return;
    }
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<TrainingDetail[]>('http://localhost:8000/trainings/', { headers }).subscribe({
      next: (response) => {
        this.allTrainings = response;
        this.allTrainingsCalendarEvents = this.allTrainings
            .filter(t => t.training_date)
            .map(t => ({
                date: new Date(t.training_date as string),
                title: t.training_name,
                trainer: t.trainer_name || 'N/A'
            }));
      },
      error: (err) => {
        console.error('Failed to fetch scheduled trainings:', err);
      }
    });
  }

  fetchAssignedTrainings(): void {
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    this.http.get<TrainingDetail[]>('http://localhost:8000/assignments/my', { headers }).subscribe({
      next: (response) => {
        this.assignedTrainings = (response || []).map(t => ({ ...t, assignmentType: 'personal' as const }));
        this.assignedTrainingsCalendarEvents = this.assignedTrainings
            .filter(t => t.training_date)
            .map(t => ({
                date: new Date(t.training_date as string),
                title: t.training_name,
                trainer: t.trainer_name || 'N/A'
            }));
        this.generateCalendar();
        this.processDashboardTrainings();
      }
    });
  }

  fetchTrainingRequests(): void {
    const token = this.authService.getToken();
    if (!token) {
      console.log('No token available for fetching training requests');
      return;
    }
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    
    console.log('Fetching training requests for engineer...');
    this.http.get<TrainingRequest[]>('http://localhost:8000/training-requests/my', { headers }).subscribe({
      next: (response) => {
        console.log('Training requests response:', response);
        this.trainingRequests = response || [];
        console.log('Training requests count:', this.trainingRequests.length);
        console.log('Training requests array:', this.trainingRequests);
      },
      error: (err) => {
        console.error('Failed to fetch training requests:', err);
        console.error('Error details:', err.error);
        console.error('Error status:', err.status);
      }
    });
  }

  get filteredTrainings(): TrainingDetail[] {
    let list = [...(this.allTrainings || [])];
    if (this.trainingSearch && this.trainingSearch.trim()) {
      const q = this.trainingSearch.trim().toLowerCase();
      list = list.filter(t =>
        (t.training_name || '').toLowerCase().includes(q) ||
        (t.training_topics || '').toLowerCase().includes(q) ||
        (t.trainer_name || '').toLowerCase().includes(q) ||
        (t.skill || '').toLowerCase().includes(q)
      );
    }
    if (this.trainingSkillFilter !== 'All') {
        list = list.filter(t => t.skill === this.trainingSkillFilter);
    }
    if (this.trainingLevelFilter !== 'All') {
        list = list.filter(t => t.skill_category === this.trainingLevelFilter);
    }
    if (this.trainingDateFilter) {
        list = list.filter(t => t.training_date === this.trainingDateFilter);
    }
    list.sort((a, b) => {
        const dateA = a.training_date ? new Date(a.training_date).getTime() : Infinity;
        const dateB = b.training_date ? new Date(b.training_date).getTime() : Infinity;
        return dateA - dateB;
    });
    return list;
  }

  // Method to get request status for a training
  getRequestStatus(trainingId: number): 'none' | 'pending' | 'approved' | 'rejected' {
    const request = this.trainingRequests.find(req => req.training_id === trainingId);
    const status = request ? request.status : 'none';
    if (request) {
      console.log(`Training ${trainingId} (${request.training?.training_name}) status: ${status}`);
    }
    return status;
  }

  // Method to get request details for a training
  getRequestDetails(trainingId: number): TrainingRequest | null {
    const request = this.trainingRequests.find(req => req.training_id === trainingId) || null;
    return request;
  }

  get filteredAssignedTrainings(): TrainingDetail[] {
      let list = [...(this.assignedTrainings || [])];
      if (this.assignedSearch && this.assignedSearch.trim()) {
        const q = this.assignedSearch.trim().toLowerCase();
        list = list.filter(t =>
          (t.training_name || '').toLowerCase().includes(q) ||
          (t.trainer_name || '').toLowerCase().includes(q) ||
          (t.skill || '').toLowerCase().includes(q)
        );
      }
      if (this.assignedSkillFilter !== 'All') {
        list = list.filter(t => t.skill === this.assignedSkillFilter);
      }
      if (this.assignedLevelFilter !== 'All') {
        list = list.filter(t => t.skill_category === this.assignedLevelFilter);
      }
      if (this.assignedDateFilter) {
        list = list.filter(t => t.training_date === this.assignedDateFilter);
      }
      list.sort((a, b) => {
        const dateA = a.training_date ? new Date(a.training_date).getTime() : Infinity;
        const dateB = b.training_date ? new Date(b.training_date).getTime() : Infinity;
        return dateA - dateB;
      });
      return list;
  }

  // --- Trainer Zone Modals & Forms ---
  openScheduleTrainingModal(): void {
    this.newTraining.trainer_name = this.employeeName || this.employeeId;
    this.showScheduleTrainingModal = true;
  }

  closeScheduleTrainingModal(): void {
    this.showScheduleTrainingModal = false;
    this.newTraining = {
      division: '',
      department: '',
      competency: '',
      skill: '',
      training_name: '',
      training_topics: '',
      prerequisites: '',
      skill_category: 'L1',
      trainer_name: '',
      email: '',
      training_date: '',
      duration: '',
      time: '',
      training_type: 'Online',
      seats: '',
      assessment_details: ''
    };
  }

  scheduleTraining(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.toastService.error('Authentication error. Please log in again.');
      return;
    }
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const payload = {
      division: this.newTraining.division || null,
      department: this.newTraining.department || null,
      competency: this.newTraining.competency || null,
      skill: this.newTraining.skill || null,
      training_name: this.newTraining.training_name,
      training_topics: this.newTraining.training_topics || null,
      prerequisites: this.newTraining.prerequisites || null,
      skill_category: this.newTraining.skill_category || null,
      trainer_name: this.newTraining.trainer_name,
      email: this.newTraining.email || null,
      training_date: this.newTraining.training_date || null,
      duration: this.newTraining.duration || null,
      time: this.newTraining.time || null,
      training_type: this.newTraining.training_type || null,
      seats: this.newTraining.seats || null,
      assessment_details: this.newTraining.assessment_details || null
    };

    this.http.post('http://localhost:8000/trainings/', payload, { headers }).subscribe({
      next: () => {
        alert('Training scheduled successfully!');
        this.closeScheduleTrainingModal();
        this.fetchScheduledTrainings();
      },
      error: (err) => {
        console.error('Failed to schedule training:', err);
        if (err.status === 422 && err.error && err.error.detail) {
          const errorDetails = err.error.detail.map((e: any) => `- Field '${e.loc[1]}': ${e.msg}`).join('\n');
          alert(`Please correct the following errors:\n${errorDetails}`);
        } else {
          alert(`Failed to schedule training. Error: ${err.statusText || 'Unknown error'}`);
        }
      }
    });
  }

  // --- Trainer Zone: Assignment & Feedback Logic ---
  setTrainerZoneView(view: 'overview' | 'assignmentForm' | 'feedbackForm'): void {
    if (view === 'overview') {
      this.resetNewAssignmentForm();
      this.resetNewFeedbackForm();
    }
    this.trainerZoneView = view;
  }

  resetNewAssignmentForm(): void {
    this.newAssignment = {
      trainingId: null,
      title: '',
      description: '',
      questions: []
    };
  }

  submitAssignment(): void {
    if (!this.newAssignment.trainingId || !this.newAssignment.title.trim() || this.newAssignment.questions.length === 0) {
      alert('Please select a training, provide a title, and add at least one question.');
      return;
    }

    for (const q of this.newAssignment.questions) {
      if (!q.text.trim()) {
        alert('Please ensure all questions have text.');
        return;
      }
      if (q.type === 'single-choice' || q.type === 'multiple-choice') {
        if (q.options.some(opt => !opt.text.trim())) {
          alert('Please ensure all options have text.');
          return;
        }
        if (!q.options.some(opt => opt.isCorrect)) {
          alert(`Please mark at least one correct answer for the question: "${q.text}"`);
          return;
        }
      }
    }

    console.log('Submitting Assignment Data:', JSON.stringify(this.newAssignment, null, 2));
    alert('Assignment with structured questions created successfully! (Simulated - check browser console for the data structure)');
    this.setTrainerZoneView('overview');
  }

  addAssignmentQuestion(): void {
    this.newAssignment.questions.push({
      text: '',
      helperText: '',
      type: 'single-choice',
      options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ]
    });
  }

  removeAssignmentQuestion(qIndex: number): void {
    this.newAssignment.questions.splice(qIndex, 1);
  }

  onQuestionTypeChange(question: AssignmentQuestion): void {
    if ((question.type === 'single-choice' || question.type === 'multiple-choice') && question.options.length === 0) {
      question.options.push({ text: '', isCorrect: false }, { text: '', isCorrect: false });
    }
    if (question.type === 'single-choice') {
        let firstCorrectFound = false;
        question.options.forEach(opt => {
            if (opt.isCorrect) {
                if (firstCorrectFound) {
                    opt.isCorrect = false;
                }
                firstCorrectFound = true;
            }
        });
    }
  }
  
  addOptionToQuestion(qIndex: number): void {
    this.newAssignment.questions[qIndex].options.push({ text: '', isCorrect: false });
  }

  removeOptionFromQuestion(qIndex: number, oIndex: number): void {
    this.newAssignment.questions[qIndex].options.splice(oIndex, 1);
  }

  toggleCorrectOption(qIndex: number, oIndex: number): void {
    const question = this.newAssignment.questions[qIndex];
    if (question.type === 'single-choice') {
      question.options.forEach((opt, index) => {
        opt.isCorrect = (index === oIndex);
      });
    } else if (question.type === 'multiple-choice') {
      question.options[oIndex].isCorrect = !question.options[oIndex].isCorrect;
    }
  }

  resetNewFeedbackForm(): void {
    this.newFeedback = { trainingId: null, customQuestions: [] };
  }

  submitFeedback(): void {
    if (!this.newFeedback.trainingId) {
      alert('Please select a training for the feedback form.');
      return;
    }
    const finalCustomQuestions = this.newFeedback.customQuestions
        .filter(q => q.text.trim() !== '')
        .map(q => ({
            ...q,
            options: q.options.filter(opt => opt.trim() !== '')
        }))
        .filter(q => q.options.length > 0);

    console.log({
      trainingId: this.newFeedback.trainingId,
      defaultQuestions: this.defaultFeedbackQuestions,
      customQuestions: finalCustomQuestions
    });
    alert('Feedback form created successfully! (Simulated)');
    this.setTrainerZoneView('overview');
  }

  addCustomQuestion(): void {
    this.newFeedback.customQuestions.push({
      text: '',
      options: [''],
      isDefault: false
    });
  }

  removeCustomQuestion(index: number): void {
    this.newFeedback.customQuestions.splice(index, 1);
  }

  addOption(questionIndex: number): void {
    this.newFeedback.customQuestions[questionIndex].options.push('');
  }

  removeOption(questionIndex: number, optionIndex: number): void {
    this.newFeedback.customQuestions[questionIndex].options.splice(optionIndex, 1);
  }

  trackByFn(index: any, item: any) {
    return index;
  }

  // --- Skills Modal Logic ---
  openSkillsModal(filterStatus: 'all' | 'Met'): void {
    // Reset modal data first
    this.modalTitle = '';
    this.modalSkills = [];
    
    if (filterStatus === 'all') {
      this.modalTitle = 'Core Skills';
      // For Core Skills, we show all core skills without status
      this.modalSkills = this.sections.map((section, index) => ({
        id: index + 1,
        skill: section.title,
        competency: section.subtitle || 'Core Competency'
      }));
      console.log('Core Skills data:', this.modalSkills);
    } else if (filterStatus === 'Met') {
      this.modalTitle = 'Skills Met';
      // For Skills Met, we show the API skills with status "Met"
      this.modalSkills = this.skills.filter(s => s.status === 'Met').map(skill => ({
        id: skill.id,
        skill: skill.skill,
        competency: skill.competency,
        current_expertise: skill.current_expertise,
        target_expertise: skill.target_expertise,
        status: skill.status
      }));
      console.log('Skills Met data:', this.modalSkills);
    }
    
    console.log('Opening modal:', { filterStatus, modalTitle: this.modalTitle, modalSkillsCount: this.modalSkills.length });
    
    // Force change detection and then show modal
    this.cdr.detectChanges();
    this.showSkillsModal = true;
  }

  closeSkillsModal(): void {
    this.showSkillsModal = false;
    // Reset modal data
    this.modalTitle = '';
    this.modalSkills = [];
    console.log('Modal closed and reset');
  }

  // --- Filter Reset Logic ---
  resetSkillFilters(): void {
    this.skillSearch = '';
    this.skillNameFilter = '';
    this.skillStatusFilter = '';
  }

  resetTrainingFilters(): void {
    this.trainingSearch = '';
    this.trainingSkillFilter = 'All';
    this.trainingLevelFilter = 'All';
    this.trainingDateFilter = '';
  }

  resetAssignedTrainingFilters(): void {
    this.assignedSearch = '';
    this.assignedSkillFilter = 'All';
    this.assignedLevelFilter = 'All';
    this.assignedDateFilter = '';
  }
  
  // --- View Toggle Logic ---
  setTrainingCatalogView(view: 'list' | 'calendar'): void {
    this.trainingCatalogView = view;
    if (view === 'calendar') {
        this.generateCalendar();
    }
  }

  setAssignedTrainingsView(view: 'list' | 'calendar'): void {
    this.assignedTrainingsView = view;
    if (view === 'calendar') {
        this.generateCalendar();
    }
  }

  // --- User Actions ---
  enrollInTraining(training: TrainingDetail): void {
    const token = this.authService.getToken();
    if (!token) {
      this.toastService.error('Authentication error. Please log in again.');
      return;
    }

    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const requestData = { training_id: training.id };

    this.http.post<TrainingRequest>('http://localhost:8000/training-requests/', requestData, { headers }).subscribe({
      next: (response) => {
        this.toastService.success(`Training request submitted successfully! Your manager will review your request for "${training.training_name}".`);
        this.fetchTrainingRequests(); // Refresh the requests list
      },
      error: (err) => {
        console.error('Failed to submit training request:', err);
        if (err.status === 400) {
          this.toastService.warning(err.error?.detail || 'You have already requested this training.');
        } else if (err.status === 404) {
          this.toastService.error('No manager found for your account. Please contact HR.');
        } else {
          this.toastService.error(`Failed to submit training request. Error: ${err.statusText || 'Unknown error'}`);
        }
      }
    });
  }

  viewAssignment(training: TrainingDetail): void {
    alert(`Opening assignment for "${training.training_name}". (This is a simulation).`);
  }

  giveFeedback(training: TrainingDetail): void {
    alert(`Opening feedback form for "${training.training_name}". (This is a simulation).`);
  }

  highlightUpcomingTrainings(): void {
    const element = document.getElementById('upcoming-trainings-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Directly apply styles for a more reliable effect
      element.style.transition = 'box-shadow 0.5s ease-in-out';
      element.style.boxShadow = '0 0 0 4px #38bdf8, 0 0 15px #0ea5e9'; // A blue glow, similar to a ring

      // Remove the styles after a delay
      setTimeout(() => {
        element.style.boxShadow = 'none';
      }, 2500);
    } else {
      console.error("DEBUG: Could not find element with id 'upcoming-trainings-section'");
    }
  }

  // --- General Helpers ---
  getFilteredSkills(): Skill[] {
    let filtered = this.skills;
    if (this.skillNameFilter) {
      filtered = filtered.filter(skill => skill.skill === this.skillNameFilter);
    }
    return filtered;
  }

  getSkillProgress(competency: Skill | ModalSkill): number {
    const extractLevel = (level: string): number => {
      if (!level) return 0;
      if (level.toUpperCase().startsWith('L')) {
        return parseInt(level.substring(1), 10) || 0;
      }
      const levelMap: { [key: string]: number } = {
        'BEGINNER': 1, 'INTERMEDIATE': 2, 'ADVANCED': 3, 'EXPERT': 4
      };
      return levelMap[level.toUpperCase()] || 0;
    };

    const current = extractLevel(competency.current_expertise || '0');
    const target = extractLevel(competency.target_expertise || '1');

    if (target === 0) return 0;

    let percent = Math.round((current / target) * 100);
    if (percent > 100) percent = 100;
    if (percent < 0) percent = 0;
    return percent;
  }

  getFormattedDate(): string {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  selectTab(tabName: string): void {
    this.activeTab = tabName;
    if (tabName === 'assignedTrainings') {
      this.fetchAssignedTrainings();
    }
    // Refresh training requests when switching to training catalog to show latest status
    if (tabName === 'trainingCatalog') {
      this.fetchTrainingRequests();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // --- Levels Tab Helpers ---
  public getLevelKey(sectionTitle: string, level: number): string {
    return `${sectionTitle}-${level}`;
  }

  public toggleLevelExpansion(key: string): void {
    if (this.expandedLevels.has(key)) {
      this.expandedLevels.delete(key);
    } else {
      this.expandedLevels.add(key);
    }
  }

  public isLevelExpanded(key: string): boolean {
    return this.expandedLevels.has(key);
  }

  // <<< NEW METHOD FOR ACCORDION >>>
  public toggleSkillExpansion(skillTitle: string): void {
    if (this.expandedSkill === skillTitle) {
        this.expandedSkill = null; // Collapse if clicking the same one again
    } else {
        this.expandedSkill = skillTitle; // Expand the new one
    }
  }

  public getLevelItems(section: Section, levelNum: number): string[] {
    const levelData = section.levels.find(l => l.level === levelNum);
    return levelData ? levelData.items : [];
  }

  getFilteredSections(): Section[] {
    let sectionsToFilter = this.sections;
    if (this.selectedSkill) {
      sectionsToFilter = this.sections.filter(sec => sec.title === this.selectedSkill);
    }
    const q = this.levelsSearch.trim().toLowerCase();
    if (!q) return sectionsToFilter;

    return sectionsToFilter.map(sec => {
      const matchTitle = sec.title.toLowerCase().includes(q) || (sec.subtitle ?? '').toLowerCase().includes(q);
      const filteredLevels = sec.levels
        .map(l => ({ ...l, items: l.items.filter(it => it.toLowerCase().includes(q)) }))
        .filter(l => l.items.length > 0);
      
      // If search query matches a skill title, show all its levels
      // Otherwise, only show levels that have matching items
      if (matchTitle) {
          return sec;
      }
      if (filteredLevels.length > 0) {
          return { ...sec, levels: filteredLevels };
      }
      return null;
    }).filter((s): s is Section => s !== null);
  }

  onSkillChange(): void {}

  // --- Visual Helpers ---
  getLevelHeaderClass = (level: number) => ['bg-red-50', 'bg-orange-50', 'bg-yellow-50', 'bg-blue-50', 'bg-green-50'][level - 1] || 'bg-gray-50';
  getLevelBadgeClass = (level: number) => ['bg-sky-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'][level - 1] || 'bg-gray-500';
  getLevelTitle = (level: number) => ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'][level - 1] || 'Unknown';
  getLevelIcon = (level: number) => ['fa-solid fa-seedling text-sky-500', 'fa-solid fa-leaf text-sky-500', 'fa-solid fa-tree text-sky-600', 'fa-solid fa-rocket text-sky-500', 'fa-solid fa-crown text-sky-500'][level - 1] || 'fa-solid fa-circle';
  getComplexityDots = (level: number) => Array.from({ length: 5 }, (_, i) => i < level);
  getProgressBarClass = () => this.progressPercentage >= 80 ? 'bg-gradient-to-r from-green-400 to-green-600' : this.progressPercentage >= 60 ? 'bg-gradient-to-r from-sky-400 to-sky-600' : this.progressPercentage >= 40 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-gradient-to-r from-orange-400 to-orange-600';

  // --- Category & Gap Logic ---
  getSkillCategory(skillName: string): string {
    const skill = skillName.toLowerCase();
    if (['c++', 'cpp', 'python', 'programming'].some(kw => skill.includes(kw))) return 'Programming';
    if (['git', 'version control'].some(kw => skill.includes(kw))) return 'Version Control';
    if (['test', 'exam', 'axivion'].some(kw => skill.includes(kw))) return 'Testing & Quality';
    if (['azure', 'devops'].some(kw => skill.includes(kw))) return 'DevOps';
    if (['doors', 'integrity', 'softcar', 'matlab'].some(kw => skill.includes(kw))) return 'Engineering Tools';
    return 'Technical';
  }

  getTrainingCardIcon(skill?: string): string {
    if (!skill) return 'fa-solid fa-laptop-code';
    const s = skill.toLowerCase();
    if (s.includes('python')) return 'fa-brands fa-python';
    if (s.includes('c++') || s.includes('cpp')) return 'fa-solid fa-file-code';
    if (s.includes('git')) return 'fa-brands fa-git-alt';
    if (s.includes('azure')) return 'fa-brands fa-microsoft';
    if (s.includes('exam') || s.includes('axivion')) return 'fa-solid fa-vial-circle-check';
    return 'fa-solid fa-laptop-code';
  }

  // --- NEW COUNTERS FOR DASHBOARD WIDGETS ---
  getAdditionalSkillsTotalCount = () => this.additionalSkills.length;
  getAdditionalTechnicalSkillsCount = () => this.additionalSkills.filter(s => s.skill_category === 'Technical').length;
  getAdditionalSoftSkillsCount = () => this.additionalSkills.filter(s => s.skill_category === 'Soft Skills').length;
  getAdditionalLeadershipSkillsCount = () => this.additionalSkills.filter(s => s.skill_category === 'Leadership').length;

  // --- Additional Skills CRUD ---
  loadAdditionalSkills(): void {
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    this.http.get<any[]>('http://localhost:8000/additional-skills/', { headers }).subscribe({
      next: (skills) => { this.additionalSkills = skills; },
      error: () => { this.additionalSkills = []; }
    });
  }

  toggleAddSkillForm(): void {
    this.showAddSkillForm = !this.showAddSkillForm;
    if (!this.showAddSkillForm) this.resetNewSkillForm();
  }

  addNewSkill(): void {
    if (!this.newSkill.name.trim()) return;
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const skillData = {
      skill_name: this.newSkill.name.trim(),
      skill_level: this.newSkill.level,
      skill_category: this.newSkill.category,
      description: this.newSkill.description.trim() || null
    };

    const request = this.editingSkillId
      ? this.http.put<any>(`http://localhost:8000/additional-skills/${this.editingSkillId}`, skillData, { headers })
      : this.http.post<any>('http://localhost:8000/additional-skills/', skillData, { headers });

    request.subscribe({
      next: (savedSkill) => {
        if (this.editingSkillId) {
          const index = this.additionalSkills.findIndex(s => s.id === this.editingSkillId);
          if (index !== -1) this.additionalSkills[index] = savedSkill;
        } else {
          this.additionalSkills.push(savedSkill);
        }
        this.resetNewSkillForm();
        this.showAddSkillForm = false;
      }
    });
  }

  removeAdditionalSkill(skillId: number): void {
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    this.http.delete(`http://localhost:8000/additional-skills/${skillId}`, { headers }).subscribe({
      next: () => { this.additionalSkills = this.additionalSkills.filter(skill => skill.id !== skillId); }
    });
  }

  editAdditionalSkill(skill: any): void {
    this.newSkill = { name: skill.skill_name, level: skill.skill_level, category: skill.skill_category, description: skill.description || '' };
    this.showAddSkillForm = true;
    this.editingSkillId = skill.id;
  }

  resetNewSkillForm(): void {
    this.newSkill = { name: '', level: 'Beginner', category: 'Technical', description: '' };
    this.editingSkillId = null;
  }

  getSkillLevelColor = (level: string) => ({
    'Beginner': 'bg-gray-100 text-gray-700 border border-gray-300',
    'Intermediate': 'bg-sky-100 text-sky-700 border border-sky-300',
    'Advanced': 'bg-violet-100 text-violet-700 border border-violet-300',
    'Expert': 'bg-amber-100 text-amber-700 border border-amber-300',
  }[level] || 'bg-gray-100 text-gray-700 border border-gray-300');

  getCategoryColor = (category: string) => ({
    'Technical': 'bg-slate-100 text-slate-700 border border-slate-300',
    'Soft Skills': 'bg-stone-100 text-stone-700 border border-stone-300',
    'Leadership': 'bg-zinc-100 text-zinc-700 border border-zinc-300',
    'Communication': 'bg-neutral-100 text-neutral-700 border border-neutral-300',
    'Project Management': 'bg-gray-100 text-gray-700 border border-gray-300',
  }[category] || 'bg-gray-100 text-gray-700 border border-gray-300');
}