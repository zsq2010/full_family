import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { NgOptimizedImage, DecimalPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { HealthLog, Mood, EnvironmentalContext } from './types';

interface QuickLogOption {
  label: string;
  mood?: Mood;
  emoji: string;
}
type EnvironmentState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-health',
  imports: [NgOptimizedImage, ReactiveFormsModule, DecimalPipe, DatePipe],
  templateUrl: './health.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthComponent implements OnInit {
  // FIX: Explicitly typing injected services for consistency and to prevent potential type inference errors.
  private authService: AuthService = inject(AuthService);
  private dataService: DataService = inject(DataService);

  loggedInUser = this.authService.currentUser;
  healthLogs = this.dataService.healthLogs;
  isSavingHealthLog = signal(false);

  // --- Health Tab Environment State ---
  currentEnvironmentalContext = signal<EnvironmentalContext | null>(null);
  environmentState = signal<EnvironmentState>('idle');
  environmentDataError = signal<string | null>(null);

  quickLogOptions: QuickLogOption[] = [
    { label: '心情不错', mood: '不错', emoji: '😊' },
    { label: '精力充沛', mood: '充沛', emoji: '⚡️' },
    { label: '有点疲惫', mood: '疲惫', emoji: '🥱' },
    { label: '压力山大', mood: '压力大', emoji: '🤯' },
    { label: '吃了药', emoji: '💊' },
    { label: '运动了', emoji: '🏃' },
    { label: '没睡好', mood: '疲惫', emoji: '😴' },
  ];

  newHealthLogForm = new FormGroup({
    content: new FormControl('', [Validators.required]),
    mood: new FormControl<Mood | undefined>(undefined),
  });

  ngOnInit(): void {
      // Automatically fetch environmental data when entering the health tab.
      this.fetchCurrentEnvironmentData();
  }

  userHealthLogs = computed(() => {
    const user = this.loggedInUser();
    if (!user) return [];
    return this.healthLogs().filter(log => log.author === user.name);
  });

  selectQuickLog(option: QuickLogOption): void {
    this.newHealthLogForm.setValue({
      content: option.label,
      mood: option.mood ?? undefined,
    });
  }

  fetchCurrentEnvironmentData(): void {
    this.environmentState.set('loading');
    this.environmentDataError.set(null);
    this.currentEnvironmentalContext.set(null);
    
    this.dataService.getEnvironmentalContext()
        .subscribe({
            next: (context) => {
                this.currentEnvironmentalContext.set(context);
                this.environmentState.set('success');
            },
            error: (err) => {
                console.error('Failed to get environmental context', err);
                let message = '无法获取您的位置或环境数据。';
                if (err.code === 1) { // PERMISSION_DENIED
                    message = '您已拒绝位置权限。请在浏览器设置中允许位置访问。';
                } else if (err.code === 2) { // POSITION_UNAVAILABLE
                    message = '无法确定您的位置，请检查设备的定位服务。';
                } else if (err.code === 3) { // TIMEOUT
                     message = '获取位置信息超时。';
                }
                this.environmentDataError.set(message);
                this.environmentState.set('error');
            }
        });
  }

  onAddNewHealthLogSubmit(): void {
    if (this.newHealthLogForm.invalid || this.isSavingHealthLog()) return;

    const currentUser = this.loggedInUser();
    if (!currentUser) return;
    
    this.isSavingHealthLog.set(true);

    const formValue = this.newHealthLogForm.value;
    const newLogData: Omit<HealthLog, 'id' | 'timestamp' | 'author'> = {
        content: formValue.content!,
        mood: formValue.mood || undefined,
        environmentalContext: this.currentEnvironmentalContext() ?? undefined,
    };

    this.dataService.addHealthLog(newLogData)
      .subscribe({
        next: () => {
            this.newHealthLogForm.reset({ content: '', mood: undefined });
            this.isSavingHealthLog.set(false);
        },
        error: () => {
             this.isSavingHealthLog.set(false);
        }
    });
  }

  // --- Template Helpers ---
  getMoodEmoji(mood: Mood): string | undefined {
    return this.quickLogOptions.find(o => o.mood === mood)?.emoji;
  }

  getWeatherIcon(code: number): string {
    if (code === 0) return '☀️'; // Clear sky
    if (code >= 1 && code <= 3) return '☁️'; // Cloudy
    if (code >= 45 && code <= 48) return '🌫️'; // Fog
    if (code >= 51 && code <= 67) return '🌧️'; // Rain/Drizzle
    if (code >= 71 && code <= 77) return '❄️'; // Snow
    if (code >= 80 && code <= 99) return '⛈️'; // Showers/Thunderstorm
    return '-';
  }

  getAqiInfo(aqi: number | undefined): { text: string; colorClasses: string } {
    if (aqi === undefined) return { text: 'N/A', colorClasses: 'bg-slate-100 text-slate-800' };
    if (aqi <= 50) return { text: '优', colorClasses: 'bg-emerald-100 text-emerald-800' };
    if (aqi <= 100) return { text: '良', colorClasses: 'bg-yellow-100 text-yellow-800' };
    if (aqi <= 150) return { text: '轻度污染', colorClasses: 'bg-orange-100 text-orange-800' };
    if (aqi <= 200) return { text: '中度污染', colorClasses: 'bg-rose-100 text-rose-800' };
    if (aqi <= 300) return { text: '重度污染', colorClasses: 'bg-purple-100 text-purple-800' };
    return { text: '严重污染', colorClasses: 'bg-red-200 text-red-900' };
  }
}