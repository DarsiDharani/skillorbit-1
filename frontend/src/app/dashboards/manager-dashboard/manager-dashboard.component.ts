import { Component, OnInit, ElementRef, QueryList, AfterViewInit, ViewChildren } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { trigger, style, animate, transition, query, stagger } from '@angular/animations';
import { ToastService, ToastMessage } from '../../services/toast.service';

interface Competency {
  skill: string;
  competency: string;
  current_expertise: string;
  target_expertise: string;
  status: 'Met' | 'Gap' | 'Error';
}

interface AdditionalSkill {
  id: number;
  skill_name: string;
  skill_level: string;
  skill_category: string;
  description?: string;
  created_at?: string;
}

interface TeamMember {
  id: string;
  name: string;
  skills: Competency[];
  additional_skills?: AdditionalSkill[];
}

interface ManagerData {
  name: string;
  role: string;
  id: string;
  skills: Competency[];
  team: TeamMember[];
  manager_is_trainer: boolean;
}

interface TrainingDetail {
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
    assigned_to?: string; // Added for team assigned trainings
}

interface TrainingRequest {
    id: number;
    training_id: number;
    employee_empid: string;
    manager_empid: string;
    request_date: string;
    status: 'pending' | 'approved' | 'rejected';
    manager_notes?: string;
    response_date?: string;
    training: TrainingDetail;
    employee: {
        username: string;
        name?: string;
    };
}

interface CalendarEvent {
  date: Date;
  title: string;
  trainer: string;
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

type LevelBlock = { level: number; items: string[] };
type Section = { title: string; subtitle?: string; levels: LevelBlock[] };

@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.css'],
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
export class ManagerDashboardComponent implements OnInit, AfterViewInit {
  @ViewChildren('animatedElement') animatedElements!: QueryList<ElementRef>;
  private observer!: IntersectionObserver;

  activeTab: string = 'dashboard';
  manager: ManagerData | null = null;
  managerDisplayName: string = '';
  managerIsTrainer: boolean = false;
  isLoading = true;
  errorMessage: string = '';
  successMessage: string = '';
  totalTeamMembers: number = 0;
  teamSkillsMet: number = 0;
  teamSkillsGap: number = 0;
  topSkillGaps: any[] = [];
  assignedTrainingsCount: number = 0; // New metric!
  
  // Dashboard view toggle
  dashboardView: 'personal' | 'team' = 'personal';
  pinnedItems: string[] = []; // For pin-to-pin feature
  
  selectedTeamMember: TeamMember | null = null;

  editingSkill: { memberId: string, skillIndex: number } | null = null;
  editSkillData: { current_expertise: string, target_expertise: string } = { current_expertise: '', target_expertise: '' };

  selectedTraining: number | null = null;
  selectedMemberId: string | null = null;

  assignTrainingSearch: string = '';
  assignMemberSearch: string = '';

  mySkillsStatusFilter: 'All' | 'Met' | 'Gap' = 'All';
  mySkillsSkillFilter: 'All' | string = 'All';
  mySkillsSearch: string = '';
  mySkillsView: 'core' | 'additional' = 'core'; // New property for the toggle UI
  teamSkillsStatusFilter: 'All' | 'Met' | 'Gap' = 'All';
  teamSkillsSkillFilter: 'All' | string = 'All';
  teamMemberNameFilter: 'All' | string = 'All';
  teamCompetencyFilter: 'All' | string = 'All';
  teamSkillsCurrentLevelFilter: 'All' | string = 'All';

  uniqueMySkills: string[] = [];
  uniqueTeamSkills: string[] = [];
  uniqueTeamMembers: string[] = [];
  uniqueCompetencies: string[] = [];
  uniqueCurrentLevels: string[] = [];

  skillLevels: string[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  skillLevelsForFilter: string[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  
  skillCategoryLevels: string[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

  additionalSkills: any[] = [];
  newSkill = {
    name: '',
    level: 'Beginner',
    category: 'Technical',
    description: ''
  };
  showAddSkillForm: boolean = false;
  editingSkillId: number | null = null;
  additionalSkillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
  skillCategories = ['Technical', 'Soft Skills', 'Leadership', 'Communication', 'Project Management', 'Other'];
  
  showScheduleTrainingModal = false;
  trainingCatalog: TrainingDetail[] = [];
  allTrainings: TrainingDetail[] = [];
  assignedTrainings: TrainingDetail[] = [];
  teamAssignedTrainings: TrainingDetail[] = [];
  pendingRequests: TrainingRequest[] = [];
  catalogSearch: string = '';
  catalogTypeFilter: string = 'All';
  catalogCategoryFilter: string = 'All';
  
  // --- Assigned Trainings Filters ---
  assignedSearch: string = '';
  assignedSkillFilter: string = 'All';
  assignedLevelFilter: string = 'All';
  assignedDateFilter: string = '';
  assignedTrainingsView: 'list' | 'calendar' = 'list';
  trainingCatalogView: 'list' | 'calendar' = 'list';

  // --- Calendar & Dashboard Metrics ---
  allTrainingsCalendarEvents: CalendarEvent[] = [];
  assignedTrainingsCalendarEvents: CalendarEvent[] = [];
  currentDate: Date = new Date();
  calendarDays: (Date | null)[] = [];
  calendarMonth: string = '';
  calendarYear: number = 2025;

  // --- Trainer Zone Properties ---
  isTrainer: boolean = false;
  trainerZoneView: 'overview' | 'assignmentForm' | 'feedbackForm' = 'overview';
  
  // Assignment and Feedback Forms
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

  // Modal properties
  showDetailModal = false;
  modalTitle = '';
  modalData: any[] = [];
  modalDataType: 'members' | 'skills' | null = null;


  private readonly API_ENDPOINT = 'http://localhost:8000/data/manager/dashboard';

  levelsSearch = '';
  selectedSkill = '';
  public expandedLevels = new Set<string>();
  public expandedSkill: string | null = null;
  levelHeaders = [
    { num: 1, title: 'Beginner' },
    { num: 2, title: 'Basic' },
    { num: 3, title: 'Intermediate' },
    { num: 4, title: 'Advanced' },
    { num: 5, title: 'Expert' }
  ];
  sections: Section[] = [
    {
      title: 'EXAM',
      levels: [
        { level: 1, items: ['Launch EXAM', 'Test execution', 'Exporting reports'] },
        { level: 2, items: ['Implement test cases', 'Create collections', 'EXAM configuration', 'DOORS synchronization'] },
        { level: 3, items: ['Create short names', 'NeKeDa reporting', 'Debugging in EXAM'] },
        { level: 4, items: ['Implement libraries & common sequences', 'Know-how on libraries (1—4)', 'Create baselines', 'Release configuration', 'Update variable mapping', 'System configurations'] },
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

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadPinnedItems();
    this.fetchDashboardData();
    this.fetchTrainingCatalog();
    this.fetchAssignedTrainings();
    this.fetchAssignedTrainingsCount();
    this.fetchTeamAssignedTrainings();
    this.fetchPendingRequests();
  }

  fetchAssignedTrainingsCount(): void {
    // This is a placeholder. In a real app, you would make an API call here.
    // For now, we'll simulate a count.
    this.assignedTrainingsCount = 12; 
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in-up');
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1
    });

    this.animatedElements.changes.subscribe((comps: QueryList<ElementRef>) => {
      comps.forEach(el => this.observer.observe(el.nativeElement));
    });
  }

  selectTab(tabName: string): void {
    if (tabName === 'trainingCatalog' || tabName === 'assignTraining' || tabName === 'trainerZone') {
        this.fetchTrainingCatalog();
    }
    if (tabName === 'assignedTrainings') {
        this.fetchAssignedTrainings();
    }
    this.selectedTeamMember = null;
    this.mySkillsStatusFilter = 'All';
    this.mySkillsSkillFilter = 'All';
    this.teamSkillsStatusFilter = 'All';
    this.teamSkillsSkillFilter = 'All';
    this.teamMemberNameFilter = 'All';
    this.teamCompetencyFilter = 'All';
    this.teamSkillsCurrentLevelFilter = 'All';
    this.activeTab = tabName;
    setTimeout(() => {
        this.animatedElements.forEach(el => this.observer.observe(el.nativeElement));
    }, 0);
  }

  // Dashboard view toggle methods
  // ============================
  // === CORRECTED THIS BLOCK ===
  // ============================
  toggleDashboardView(): void {
    // The call to fetchTeamAssignedTrainings() was removed from here.
    // It's already called in ngOnInit(), so the data is loaded once when the component
    // initializes, which is more efficient.
    this.dashboardView = this.dashboardView === 'personal' ? 'team' : 'personal';
  }

  // Pin-to-pin feature methods
  togglePin(item: string): void {
    const index = this.pinnedItems.indexOf(item);
    if (index > -1) {
      this.pinnedItems.splice(index, 1);
    } else {
      this.pinnedItems.push(item);
    }
    // Save to localStorage for persistence
    localStorage.setItem('managerPinnedItems', JSON.stringify(this.pinnedItems));
  }

  isPinned(item: string): boolean {
    return this.pinnedItems.includes(item);
  }

  loadPinnedItems(): void {
    const saved = localStorage.getItem('managerPinnedItems');
    if (saved) {
      this.pinnedItems = JSON.parse(saved);
    }
  }

  // Team dashboard specific methods
  getTeamSkillGaps(): any[] {
    if (!this.manager) return [];
    const allTeamSkills = this.manager.team.flatMap(member => member.skills);
    const skillGapCount: { [key: string]: number } = {};
    allTeamSkills.forEach(skill => {
      if (skill.status === 'Gap') {
        skillGapCount[skill.skill] = (skillGapCount[skill.skill] || 0) + 1;
      }
    });
    return Object.entries(skillGapCount)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count);
  }

  getTeamMembersWithGaps(): TeamMember[] {
    if (!this.manager) return [];
    return this.manager.team.filter(member => 
      member.skills.some(skill => skill.status === 'Gap')
    );
  }

  getTeamProgressByMember(): { member: TeamMember; progress: number }[] {
    if (!this.manager) return [];
    return this.manager.team.map(member => ({
      member,
      progress: this.calculateProgress(member.skills)
    })).sort((a, b) => b.progress - a.progress);
  }

  getUpcomingTeamTrainings(): TrainingDetail[] {
    // This would typically come from an API call for team assigned trainings
    return this.assignedTrainings.filter(t => 
      t.training_date && new Date(t.training_date) >= new Date()
    ).slice(0, 5);
  }

  // Get trainings assigned by the manager to team members
  getTeamAssignedTrainings(): TrainingDetail[] {
    // This will be populated from the team assigned trainings API call
    return this.teamAssignedTrainings || [];
  }

  // Get the name of the team member for a given employee ID
  getAssignedMemberName(employeeId: string | undefined): string {
    if (!employeeId || !this.manager || !this.manager.team) return employeeId || 'Unknown';
    const member = this.manager.team.find(m => m.id === employeeId);
    return member ? member.name : employeeId;
  }

  // Personal dashboard methods (same as engineer dashboard)
  getPersonalProgressPercentage(): number {
    if (!this.manager?.skills?.length) return 0;
    const totalSkills = this.manager.skills.length;
    const metSkills = this.getMySkillsMetCount();
    return totalSkills > 0 ? Math.round((metSkills / totalSkills) * 100) : 0;
  }

  getUpcomingPersonalTrainings(): TrainingDetail[] {
    if (!this.assignedTrainings || this.assignedTrainings.length === 0) {
      return [];
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.assignedTrainings
      .filter(t => t.training_date && new Date(t.training_date) >= today)
      .sort((a, b) => {
        return new Date(a.training_date!).getTime() - new Date(b.training_date!).getTime();
      });
  }

  highlightUpcomingTrainings(): void {
    const element = document.getElementById('upcoming-trainings-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.transition = 'box-shadow 0.5s ease-in-out';
      element.style.boxShadow = '0 0 0 4px #38bdf8, 0 0 15px #0ea5e9';
      setTimeout(() => {
        element.style.boxShadow = 'none';
      }, 2500);
    }
  }

  getTrainingCardIcon(skill?: string | null): string {
    if (!skill) return 'fa-solid fa-laptop-code';
    const skillLower = skill.toLowerCase();
    if (skillLower.includes('softcar')) return 'fa-solid fa-car';
    if (skillLower.includes('integrity')) return 'fa-solid fa-shield-halved';
    if (skillLower.includes('exam')) return 'fa-solid fa-microscope';
    if (skillLower.includes('cpp') || skillLower.includes('c++')) return 'fa-solid fa-code';
    if (skillLower.includes('python')) return 'fa-brands fa-python';
    if (skillLower.includes('matlab')) return 'fa-solid fa-chart-line';
    if (skillLower.includes('doors')) return 'fa-solid fa-door-open';
    if (skillLower.includes('azure')) return 'fa-brands fa-microsoft';
    if (skillLower.includes('git')) return 'fa-brands fa-git-alt';
    if (skillLower.includes('axivion')) return 'fa-solid fa-search';
    return 'fa-solid fa-laptop-code';
  }

  // Fetch team assigned trainings
  fetchTeamAssignedTrainings(): void {
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    
    this.http.get<TrainingDetail[]>('http://localhost:8000/assignments/manager/team', { headers }).subscribe({
      next: (response) => {
        console.log('Team assigned trainings loaded:', response);
        this.teamAssignedTrainings = response || [];
      },
      error: (err) => {
        console.error('Failed to fetch team assigned trainings:', err);
        this.teamAssignedTrainings = [];
      }
    });
  }
  
  openScheduleTrainingModal(): void {
    if (this.manager) {
      this.newTraining.trainer_name = this.manager.name;
    }
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

  // New Modal Methods
  openDetailModal(type: 'mySkillsMet' | 'mySkillGaps' | 'teamSkillsMet' | 'teamSkillGaps' | 'totalMembers' | 'additionalSkills' | 'coreSkills') {
    if (!this.manager) return;
    
    this.modalDataType = null;

    switch(type) {
      case 'totalMembers':
        this.modalTitle = 'Total Team Members';
        this.modalData = this.manager.team;
        this.modalDataType = 'members';
        break;
      case 'coreSkills':
        this.modalTitle = 'Core Skills';
        // For Core Skills, we show all core skills without status
        this.modalData = this.sections.map((section, index) => ({
          id: index + 1,
          skill: section.title,
          competency: section.subtitle || 'Core Competency'
        }));
        this.modalDataType = 'skills';
        break;
      case 'mySkillsMet':
        this.modalTitle = 'My Skills Met';
        this.modalData = this.manager.skills.filter(s => s.status === 'Met');
        this.modalDataType = 'skills';
        break;
      case 'mySkillGaps':
        this.modalTitle = 'My Skill Gaps';
        this.modalData = this.manager.skills.filter(s => s.status === 'Gap');
        this.modalDataType = 'skills';
        break;
      case 'teamSkillsMet':
        this.modalTitle = 'Team Skills Met';
        this.modalData = this.manager.team.flatMap(m => m.skills.filter(s => s.status === 'Met').map(s => ({...s, memberName: m.name})));
        this.modalDataType = 'skills';
        break;
      case 'teamSkillGaps':
        this.modalTitle = 'Team Skill Gaps';
        this.modalData = this.manager.team.flatMap(m => m.skills.filter(s => s.status === 'Gap').map(s => ({...s, memberName: m.name})));
        this.modalDataType = 'skills';
        break;
      case 'additionalSkills':
          this.modalTitle = 'My Additional Skills';
          this.modalData = this.additionalSkills;
          this.modalDataType = 'skills'; // Reuse skills template for this
          break;
    }
    this.showDetailModal = true;
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.modalTitle = '';
    this.modalData = [];
    this.modalDataType = null;
  }


  scheduleTraining(): void {
    const token = this.authService.getToken();
    if (!token) {
        this.errorMessage = 'Authentication error. Please log in again.';
        return;
    }
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    const payload = {
      division: this.newTraining.division || null,
      department: this.newTraining.department || null,
      training_name: this.newTraining.training_name,
      training_topics: this.newTraining.training_topics,
      prerequisites: this.newTraining.prerequisites,
      skill_category: this.newTraining.skill_category,
      trainer_name: this.newTraining.trainer_name,
      email: this.newTraining.email,
      training_date: this.newTraining.training_date || null,
      duration: this.newTraining.duration,
      time: this.newTraining.time,
      training_type: this.newTraining.training_type,
      seats: this.newTraining.seats,
      assessment_details: this.newTraining.assessment_details
    };

    this.http.post('http://localhost:8000/trainings/', payload, { headers }).subscribe({
        next: (response) => {
            alert('Training scheduled successfully!');
            this.closeScheduleTrainingModal();
            this.fetchTrainingCatalog();
        },
        error: (err) => {
            if (err.status === 422 && err.error && err.error.detail) {
              const errorDetails = err.error.detail.map((e: any) => `- Field '${e.loc[1]}': ${e.msg}`).join('\n');
              const fullErrorMessage = `Please correct the following errors:\n${errorDetails}`;
              this.errorMessage = fullErrorMessage;
              alert(fullErrorMessage);
            } else {
              const detail = err.error?.detail || 'An unknown error occurred. Check the server logs.';
              this.errorMessage = `Failed to schedule training: ${detail}`;
              alert(this.errorMessage);
            }
        }
    });
  }

  approveRequest(request: TrainingRequest, notes?: string): void {
    this.respondToRequest(request, 'approved', notes);
  }

  rejectRequest(request: TrainingRequest, notes?: string): void {
    this.respondToRequest(request, 'rejected', notes);
  }

  respondToRequestById(requestId: number, status: 'approved' | 'rejected'): void {
    const request = this.pendingRequests.find(r => r.id === requestId);
    if (request) {
      this.respondToRequest(request, status);
    }
  }

  private respondToRequest(request: TrainingRequest, status: 'approved' | 'rejected', notes?: string): void {
    const token = this.authService.getToken();
    if (!token) {
      this.toastService.error('Authentication error. Please log in again.');
      return;
    }

    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const responseData = {
      status: status,
      manager_notes: notes || null
    };

    this.http.put(`http://localhost:8000/training-requests/${request.id}/respond`, responseData, { headers }).subscribe({
      next: (response) => {
        this.toastService.success(`Training request ${status} successfully!`);
        this.fetchPendingRequests(); // Refresh the requests list
      },
      error: (err) => {
        console.error(`Failed to ${status} training request:`, err);
        this.toastService.error(`Failed to ${status} training request. Error: ${err.statusText || 'Unknown error'}`);
      }
    });
  }

  fetchTrainingCatalog(): void {
    const token = this.authService.getToken();
    if (!token) {
        return;
    }
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<TrainingDetail[]>('http://localhost:8000/trainings/', { headers }).subscribe({
      next: (data) => {
        console.log('Training catalog data loaded:', data);
        this.trainingCatalog = data;
        this.allTrainings = data; // Align with engineer dashboard
        this.allTrainingsCalendarEvents = this.allTrainings
          .filter(t => t.training_date)
          .map(t => ({
            date: new Date(t.training_date as string),
            title: t.training_name,
            trainer: t.trainer_name || 'N/A'
          }));
      },
      error: (err) => {
        console.error('Failed to load training catalog:', err);
        this.errorMessage = 'Failed to load training catalog.';
      }
    });
  }

  fetchPendingRequests(): void {
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    
    this.http.get<TrainingRequest[]>('http://localhost:8000/training-requests/pending', { headers }).subscribe({
      next: (response) => {
        this.pendingRequests = response || [];
      },
      error: (err) => {
        console.error('Failed to fetch pending requests:', err);
      }
    });
  }

  fetchAssignedTrainings(): void {
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    
    // For managers, only fetch personal assigned trainings (assigned to the manager by their manager)
    // Team assigned trainings should not be shown in the "Assigned Trainings" tab
    this.http.get<TrainingDetail[]>('http://localhost:8000/assignments/my', { headers }).subscribe({
      next: (response) => {
        console.log('Personal assigned trainings loaded:', response);
        this.assignedTrainings = (response || []).map(t => ({ ...t, assignmentType: 'personal' as const }));
        this.assignedTrainingsCalendarEvents = this.assignedTrainings
          .filter(t => t.training_date)
          .map(t => ({
            date: new Date(t.training_date as string),
            title: t.training_name,
            trainer: t.trainer_name || 'N/A'
          }));
        this.generateCalendar();
      },
      error: (err) => {
        console.error('Failed to fetch assigned trainings:', err);
        this.assignedTrainings = [];
        this.assignedTrainingsCalendarEvents = [];
      }
    });
  }

  get filteredCatalog(): TrainingDetail[] {
    let list = [...(this.trainingCatalog || [])];
    if (this.catalogSearch && this.catalogSearch.trim()) {
      const q = this.catalogSearch.trim().toLowerCase();
      list = list.filter(t =>
        (t.training_name || '').toLowerCase().includes(q) ||
        (t.training_topics || '').toLowerCase().includes(q) ||
        (t.trainer_name || '').toLowerCase().includes(q) ||
        (t.skill || '').toLowerCase().includes(q)
      );
    }
    if (this.catalogTypeFilter !== 'All') {
      list = list.filter(t => (t.training_type || '').toLowerCase() === this.catalogTypeFilter.toLowerCase());
    }
    if (this.catalogCategoryFilter !== 'All') {
      list = list.filter(t => (t.skill_category || '').toLowerCase() === this.catalogCategoryFilter.toLowerCase());
    }
    
    list.sort((a, b) => {
      const dateA = a.training_date ? new Date(a.training_date).getTime() : Infinity;
      const dateB = b.training_date ? new Date(b.training_date).getTime() : Infinity;
      return dateA - dateB;
    });
    
    return list;
  }

  get myTrainings(): TrainingDetail[] {
    if (!this.manager) return [];
    return this.trainingCatalog
      .filter(t => t.trainer_name === this.manager?.name)
      .sort((a, b) => {
        const dateA = a.training_date ? new Date(a.training_date).getTime() : 0;
        const dateB = b.training_date ? new Date(b.training_date).getTime() : 0;
        return dateB - dateA; // Sort descending
      });
  }

  isUpcoming(dateStr?: string): boolean {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dateStr) >= today;
  }

  fetchDashboardData(): void {
    this.isLoading = true;
    const token = this.authService.getToken();
    const userRole = this.authService.getRole();
      
    if (!token || userRole !== 'manager') {
      this.errorMessage = 'Authentication token not found or invalid role. Please log in again.';
      this.isLoading = false;
      this.router.navigate(['/login']);
      return;
    }
      
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any>(this.API_ENDPOINT, { headers }).subscribe({
      next: (response) => {
        this.manager = response;
        const anyResp: any = response as any;
        this.managerDisplayName = (anyResp.employee_name && String(anyResp.employee_name).trim())
          || (response.name && String(response.name).trim())
          || (response.id && String(response.id).trim())
          || '';
        this.managerIsTrainer = !!response.manager_is_trainer;
        this.processDashboardData();
        this.extractUniqueMySkills();
        this.extractUniqueTeamSkills();
        this.extractUniqueTeamMembers();
        this.extractUniqueCompetencies();
        this.extractUniqueCurrentLevels();
        this.loadAdditionalSkills();
        this.isLoading = false;
        this.errorMessage = '';
      },
      error: (err) => {
        this.errorMessage = 'Failed to load dashboard data. Please ensure the API is running and the endpoint is correct.';
        console.error('Error fetching data:', err);
        this.isLoading = false;
      }
    });
  }

  processDashboardData(): void {
    if (!this.manager) return;
    this.totalTeamMembers = this.manager.team.length;
    const allTeamSkills = this.manager.team.flatMap((member: TeamMember) => member.skills);
    this.teamSkillsMet = allTeamSkills.filter((skill: Competency) => skill.status === 'Met').length;
    this.teamSkillsGap = allTeamSkills.filter((skill: Competency) => skill.status === 'Gap').length;
    
    const skillGapCount: { [key: string]: number } = {};
    allTeamSkills.forEach((skill: Competency) => {
      if (skill.status === 'Gap') {
        skillGapCount[skill.skill] = (skillGapCount[skill.skill] || 0) + 1;
      }
    });

    this.topSkillGaps = Object.entries(skillGapCount)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // Limit to top 3 for a more compact view
  }
  
  extractUniqueMySkills(): void {
    if (this.manager && this.manager.skills) {
      this.uniqueMySkills = [...new Set(this.manager.skills.map(skill => skill.skill))];
    }
  }

  extractUniqueTeamSkills(): void {
    if (this.manager && this.manager.team) {
      const allSkills = this.manager.team.flatMap(member => member.skills.map(skill => skill.skill));
      this.uniqueTeamSkills = [...new Set(allSkills)];
    }
  }

  extractUniqueTeamMembers(): void {
    if (this.manager && this.manager.team) {
      this.uniqueTeamMembers = [...new Set(this.manager.team.map(member => member.name))];
    }
  }

  extractUniqueCompetencies(): void {
    if (this.manager && this.manager.team) {
      const allCompetencies = this.manager.team.flatMap(member =>
        member.skills.map(skill => skill.competency).filter(comp => comp)
      );
      this.uniqueCompetencies = [...new Set(allCompetencies)];
    }
  }

  extractUniqueCurrentLevels(): void {
    if (this.manager && this.manager.team) {
      const allLevels = this.manager.team.flatMap(member =>
        member.skills.map(skill => skill.current_expertise).filter(level => level)
      );
      this.uniqueCurrentLevels = [...new Set(allLevels)];
    }
  }

  assignTraining(): void {
    if (!this.selectedTraining) {
      this.toastService.warning('Please select a training module.');
      return;
    }
    if (!this.selectedMemberId) {
      this.toastService.warning('Please select a team member.');
      return;
    }
    const trainingName = this.trainingCatalog.find(t => t.id === this.selectedTraining)?.training_name;
    const memberName = this.manager?.team.find(m => m.id === this.selectedMemberId)?.name;

    const token = this.authService.getToken();
    if (!token) {
      this.toastService.error('Authentication token missing. Please login again.');
      return;
    }
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    const payload = { training_id: this.selectedTraining, employee_username: this.selectedMemberId };
    this.http.post('http://localhost:8000/assignments/', payload, { headers }).subscribe({
      next: () => {
        this.toastService.success(`Assigned "${trainingName}" to ${memberName}`);
        this.selectedTraining = null;
        this.selectedMemberId = null;
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to assign training.';
        this.toastService.error(msg);
      }
    });
  }

  getSelectedTrainingName(): string {
    if (!this.selectedTraining) return '...';
    return this.trainingCatalog.find(t => t.id === this.selectedTraining)?.training_name || '...';
  }

  getSelectedMemberName(): string {
    if (!this.selectedMemberId || !this.manager) return '...';
    return this.manager.team.find(m => m.id === this.selectedMemberId)?.name || '...';
  }

  calculateProgress(skills: Competency[]): number {
    const total = skills.length;
    const met = skills.filter(s => s.status === 'Met').length;
    return total > 0 ? (met / total) * 100 : 0;
  }

  getTeamProgressPercentage(): number {
    const totalSkills = this.manager?.team.flatMap(member => member.skills).length || 0;
    const metSkills = this.manager?.team.flatMap(member => member.skills).filter(skill => skill.status === 'Met').length || 0;
    return totalSkills > 0 ? Math.round((metSkills / totalSkills) * 100) : 0;
  }

  getMySkillsMetCount(): number {
    return this.manager?.skills.filter(skill => skill.status === 'Met').length || 0;
  }

  getSkillProgress(skill: Competency): number {
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

    const current = extractLevel(skill.current_expertise);
    const target = extractLevel(skill.target_expertise);

    if (target === 0) return 0;

    let percent = Math.round((current / target) * 100);
    if (percent > 100) percent = 100;
    if (percent < 0) percent = 0;
    return percent;
  }

  getFilteredMySkills(): Competency[] {
    if (!this.manager || !this.manager.skills) {
      return [];
    }
    let filtered = [...this.manager.skills];
    if (this.mySkillsSearch) {
      filtered = filtered.filter(skill =>
        skill.skill.toLowerCase().includes(this.mySkillsSearch.toLowerCase())
      );
    }
    if (this.mySkillsStatusFilter !== 'All') {
      filtered = filtered.filter(skill => skill.status === this.mySkillsStatusFilter);
    }
    if (this.mySkillsSkillFilter !== 'All') {
      filtered = filtered.filter(skill => skill.skill === this.mySkillsSkillFilter);
    }
    return filtered;
  }

  getTeamSkillsMetCount(member: TeamMember): number {
    return member.skills.filter(s => s.status === 'Met').length;
  }

  viewMemberDetails(member: TeamMember): void {
    this.selectedTeamMember = member;
  }

  clearMemberDetails(): void {
    this.selectedTeamMember = null;
    this.cancelEditSkill();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  get filteredTeamMembers(): TeamMember[] {
    if (!this.manager || !this.manager.team) {
      return [];
    }
    let filteredMembers = [...this.manager.team];
    if (this.teamMemberNameFilter !== 'All') {
      filteredMembers = filteredMembers.filter(member => member.name === this.teamMemberNameFilter);
    }
    if (this.teamSkillsStatusFilter !== 'All' || this.teamSkillsSkillFilter !== 'All' || this.teamCompetencyFilter !== 'All' || this.teamSkillsCurrentLevelFilter !== 'All') {
      filteredMembers = filteredMembers.filter(member => {
        return member.skills.some(skill => {
          const statusMatch = this.teamSkillsStatusFilter === 'All' || skill.status === this.teamSkillsStatusFilter;
          const skillMatch = this.teamSkillsSkillFilter === 'All' || skill.skill === this.teamSkillsSkillFilter;
          const competencyMatch = this.teamCompetencyFilter === 'All' || skill.competency === this.teamCompetencyFilter;
          const levelMatch = this.teamSkillsCurrentLevelFilter === 'All' || skill.current_expertise === this.teamSkillsCurrentLevelFilter;
          return statusMatch && skillMatch && competencyMatch && levelMatch;
        });
      });
    }
    return filteredMembers;
  }

  get filteredAssignTrainings(): TrainingDetail[] {
    let list = [...(this.trainingCatalog || [])];
    const q = (this.assignTrainingSearch || '').trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        (t.training_name || '').toLowerCase().includes(q) ||
        (t.training_topics || '').toLowerCase().includes(q) ||
        (t.trainer_name || '').toLowerCase().includes(q) ||
        (t.training_type || '').toLowerCase().includes(q)
      );
    }
    return list;
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

  get filteredAssignMembers(): TeamMember[] {
    if (!this.manager || !this.manager.team) return [];
    const q = (this.assignMemberSearch || '').trim().toLowerCase();
    if (!q) return this.manager.team;
    return this.manager.team.filter(m => (m.name || '').toLowerCase().includes(q));
  }

  startEditSkill(memberId: string, skillIndex: number): void {
    const member = this.manager?.team.find(m => m.id === memberId);
    if (member && member.skills[skillIndex]) {
      this.editingSkill = { memberId, skillIndex };
      this.editSkillData = {
        current_expertise: member.skills[skillIndex].current_expertise,
        target_expertise: member.skills[skillIndex].target_expertise
      };
      this.errorMessage = '';
      this.successMessage = '';
    }
  }

  cancelEditSkill(): void {
    this.editingSkill = null;
    this.editSkillData = { current_expertise: '', target_expertise: '' };
  }

  saveSkillEdit(): void {
    if (!this.editingSkill || !this.manager) return;
    const member = this.manager.team.find(m => m.id === this.editingSkill!.memberId);
    if (member && member.skills[this.editingSkill.skillIndex]) {
      const skill = member.skills[this.editingSkill.skillIndex];
      const updateRequest = {
        employee_username: member.id,
        skill_name: skill.skill,
        current_expertise: this.editSkillData.current_expertise,
        target_expertise: this.editSkillData.target_expertise
      };
      const token = this.authService.getToken();
      if (!token) {
        this.errorMessage = 'Authentication token not found. Please login again.';
        return;
      }
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
      this.http.put('http://localhost:8000/data/manager/team-skill', updateRequest, { headers })
        .subscribe({
          next: (response: any) => {
            skill.current_expertise = response.current_expertise;
            skill.target_expertise = response.target_expertise;
            skill.status = response.status;
            this.processDashboardData();
            this.cancelEditSkill();
            this.successMessage = `Skill "${skill.skill}" updated successfully!`;
            setTimeout(() => { this.successMessage = ''; }, 3000);
          },
          error: (error) => {
            this.errorMessage = 'Failed to update skill. Please try again.';
          }
        });
    }
  }

  isEditingSkill(memberId: string, skillIndex: number): boolean {
    return this.editingSkill?.memberId === memberId && this.editingSkill?.skillIndex === skillIndex;
  }

  // Additional Skills Management
  loadAdditionalSkills(): void {
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    this.http.get<any[]>('http://localhost:8000/additional-skills/', { headers }).subscribe({
      next: (skills) => { this.additionalSkills = skills; },
      error: (err) => { this.additionalSkills = []; }
    });
  }

  toggleAddSkillForm(): void {
    this.showAddSkillForm = !this.showAddSkillForm;
    if (!this.showAddSkillForm) {
      this.resetNewSkillForm();
    }
  }

  addNewSkill(): void {
    if (this.newSkill.name.trim()) {
      const token = this.authService.getToken();
      if (!token) return;
      const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
      const skillData = {
        skill_name: this.newSkill.name.trim(),
        skill_level: this.newSkill.level,
        skill_category: this.newSkill.category,
        description: this.newSkill.description.trim() || null
      };
      if (this.editingSkillId) {
        this.http.put<any>(`http://localhost:8000/additional-skills/${this.editingSkillId}`, skillData, { headers }).subscribe({
          next: (updatedSkill) => {
            const index = this.additionalSkills.findIndex(s => s.id === this.editingSkillId);
            if (index !== -1) { this.additionalSkills[index] = updatedSkill; }
            this.resetNewSkillForm();
            this.showAddSkillForm = false;
          },
          error: (err) => { console.error('Failed to update skill:', err); }
        });
      } else {
        this.http.post<any>('http://localhost:8000/additional-skills/', skillData, { headers }).subscribe({
          next: (newSkill) => {
            this.additionalSkills.push(newSkill);
            this.resetNewSkillForm();
            this.showAddSkillForm = false;
          },
          error: (err) => { console.error('Failed to add skill:', err); }
        });
      }
    }
  }

  removeAdditionalSkill(skillId: number): void {
    const token = this.authService.getToken();
    if (!token) return;
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
    this.http.delete(`http://localhost:8000/additional-skills/${skillId}`, { headers }).subscribe({
      next: () => { this.additionalSkills = this.additionalSkills.filter(skill => skill.id !== skillId); },
      error: (err) => { console.error('Failed to delete skill:', err); }
    });
  }

  editAdditionalSkill(skill: any): void {
    this.newSkill = {
      name: skill.skill_name,
      level: skill.skill_level,
      category: skill.skill_category,
      description: skill.description || ''
    };
    this.showAddSkillForm = true;
    this.editingSkillId = skill.id;
  }

  resetNewSkillForm(): void {
    this.newSkill = { name: '', level: 'Beginner', category: 'Technical', description: '' };
    this.editingSkillId = null;
  }

  getSkillLevelColor(level: string): string {
    switch (level) {
      case 'Expert': return 'bg-purple-100 text-purple-800';
      case 'Advanced': return 'bg-blue-100 text-blue-800';
      case 'Intermediate': return 'bg-green-100 text-green-800';
      case 'Beginner': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getCategoryColor(category: string): string {
    switch (category) {
      case 'Technical': return 'bg-slate-100 text-slate-700 border border-slate-300';
      case 'Soft Skills': return 'bg-stone-100 text-stone-700 border border-stone-300';
      case 'Leadership': return 'bg-zinc-100 text-zinc-700 border border-zinc-300';
      case 'Communication': return 'bg-neutral-100 text-neutral-700 border border-neutral-300';
      case 'Project Management': return 'bg-gray-100 text-gray-700 border border-gray-300';
      default: return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  }
  
  // Levels helper methods
  getFilteredSections(): Section[] {
    let sectionsToFilter = this.sections;
    if (this.selectedSkill) {
      sectionsToFilter = this.sections.filter((sec: any) => sec.title === this.selectedSkill);
    }
    const q = this.levelsSearch.trim().toLowerCase();
    if (!q) return sectionsToFilter;

    return sectionsToFilter.map((sec: any) => {
      const matchTitle = sec.title.toLowerCase().includes(q) || (sec.subtitle ?? '').toLowerCase().includes(q);
      const filteredLevels = sec.levels
        .map((l: any) => ({ ...l, items: l.items.filter((it: string) => it.toLowerCase().includes(q)) }))
        .filter((l: any) => l.items.length > 0 || `level ${l.level}`.includes(q));
      if (matchTitle || filteredLevels.length) {
        return { ...sec, levels: matchTitle ? sec.levels : filteredLevels };
      }
      return null;
    }).filter((s: any) => s !== null);
  }

  getLevelHeaderClass = (level: number) => ['bg-red-50', 'bg-orange-50', 'bg-yellow-50', 'bg-indigo-50', 'bg-green-50'][level - 1] || 'bg-gray-50';
  getLevelBadgeClass = (level: number) => ['bg-indigo-500', 'bg-indigo-500', 'bg-indigo-500', 'bg-indigo-500', 'bg-indigo-500'][level - 1] || 'bg-gray-500';
  getLevelTitle = (level: number) => ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'][level - 1] || 'Unknown';
  getLevelIcon = (level: number) => ['fa-solid fa-seedling text-indigo-500', 'fa-solid fa-leaf text-indigo-500', 'fa-solid fa-tree text-indigo-600', 'fa-solid fa-rocket text-indigo-500', 'fa-solid fa-crown text-indigo-500'][level - 1] || 'fa-solid fa-circle';
  getComplexityDots = (level: number) => Array.from({ length: 5 }, (_, i) => i < level);
  onSkillChange(): void {}

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

  // --- Filter Reset Logic ---
  resetMySkillsFilters(): void {
    this.mySkillsSearch = '';
    this.mySkillsSkillFilter = 'All';
    this.mySkillsStatusFilter = 'All';
  }

  resetCatalogFilters(): void {
    this.catalogSearch = '';
    this.catalogTypeFilter = 'All';
    this.catalogCategoryFilter = 'All';
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

  // --- Trainer Zone Methods ---
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

  // --- Missing Methods ---
  viewAssignment(training: any): void {
    // TODO: Implement view assignment functionality
    console.log('Viewing assignment for training:', training);
  }

  giveFeedback(training: any): void {
    // TODO: Implement give feedback functionality
    console.log('Giving feedback for training:', training);
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

  getEventForDate(date: Date | null, events: CalendarEvent[]): CalendarEvent[] {
    if (!date) return [];
    return events.filter(event =>
      event.date.getDate() === date.getDate() &&
      event.date.getMonth() === date.getMonth() &&
      event.date.getFullYear() === date.getFullYear()
    );
  }

  trackByEventId(index: number, event: CalendarEvent): string {
    return event.title + event.trainer + event.date.getTime();
  }


  // --- Training Enrollment ---
  enrollInTraining(training: TrainingDetail): void {
    // This is a placeholder method. In a real app, you would make an API call here.
    alert(`Enrolled in "${training.training_name}" successfully!`);
  }
}