import { Component, ChangeDetectionStrategy, computed, inject, OnInit, signal, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

import { DataService } from './data.service';
import { UserApplicationEntry, ConfigData } from './types';

@Component({
  selector: 'app-app-detail',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './app-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDetailComponent implements OnInit {
  // FIX: Explicitly typing injected services to fix type inference issues causing '... on type unknown' errors.
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private dataService: DataService = inject(DataService);
  private fb: FormBuilder = inject(FormBuilder);

  appId = signal<string>('');
  isSaving = signal(false);

  // Find the specific application entry from the data service's signal
  appEntry = computed<UserApplicationEntry | undefined>(() => {
    const id = this.appId();
    if (!id) return undefined;
    return this.dataService.userApplications().find(app => app.application.id === id);
  });

  // The main form group for configuration
  configForm: FormGroup = this.fb.group({});

  // Signal to hold the keys of the configuration for iterating in the template, excluding userSettings
  configKeys = signal<string[]>([]);
  
  // A helper to check the type of a value for template rendering
  getValueType(value: unknown): 'string' | 'number' | 'boolean' | 'object' {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return 'object';
    return 'string';
  }

  // Helper for the template to get keys of a nested object
  getObjectKeys(obj: unknown): string[] {
    if (this.getValueType(obj) === 'object') {
      return Object.keys(obj as object);
    }
    return [];
  }

  constructor() {
     // Effect to build the form when appEntry is available
    effect(() => {
      const entry = this.appEntry();
      if (entry) {
        this.buildForm(entry);
      }
    });
  }

  ngOnInit(): void {
    // Get the app ID from the route params
    this.route.paramMap.subscribe(params => {
      this.appId.set(params.get('id') || '');
    });
  }

  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }
  
  private isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
  
  private buildForm(entry: UserApplicationEntry): void {
    const defaultConfig = entry.application.defaultConfig || {};
    const userConfig = entry.appConfigs?.[0]?.configData || {};
    
    // Merge user config over default config to get the full initial state
    const effectiveConfig = this.deepMerge(defaultConfig, userConfig);

    // Build the form group dynamically
    this.configForm = this.buildFormGroup(effectiveConfig);
    
    // Set the keys for template iteration, excluding 'userSettings'
    this.configKeys.set(Object.keys(effectiveConfig).filter(k => k !== 'userSettings'));
  }

  private buildFormGroup(obj: ConfigData): FormGroup {
    if (!obj) return this.fb.group({});
    
    const group = this.fb.group({});
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (this.getValueType(value) === 'object') {
        group.addControl(key, this.buildFormGroup(value as ConfigData));
      } else {
        group.addControl(key, this.fb.control(value));
      }
    }
    return group;
  }

  saveChanges(): void {
    if (this.configForm.invalid || this.isSaving()) return;
    this.isSaving.set(true);

    const entry = this.appEntry();
    if (!entry) {
      this.isSaving.set(false);
      return;
    }

    const newConfigData = this.configForm.value;
    const currentConfig = entry.appConfigs?.[0];

    if (currentConfig) {
      // Update existing config
      this.dataService.updateAppConfig(currentConfig.id, newConfigData).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.router.navigate(['/apps']);
        },
        error: () => this.isSaving.set(false)
      });
    } else {
      // Create new config
      const newAppConfig = {
        appId: entry.application.id,
        environment: 'development', // This should be dynamic in a real app
        configData: newConfigData
      };
      this.dataService.createAppConfig(newAppConfig).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.router.navigate(['/apps']);
        },
        error: () => this.isSaving.set(false)
      });
    }
  }
}