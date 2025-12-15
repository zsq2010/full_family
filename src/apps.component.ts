import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { UserApplicationEntry, ConfigData } from './types';

@Component({
  selector: 'app-apps',
  imports: [RouterLink],
  templateUrl: './apps.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppsComponent implements OnInit {
  // FIX: Explicitly typing injected services for consistency and to prevent potential type inference errors.
  private authService: AuthService = inject(AuthService);
  private dataService: DataService = inject(DataService);
  
  loggedInUser = this.authService.currentUser;
  userApps = this.dataService.userApplications;

  ngOnInit(): void {
    this.dataService.getUserApplications().subscribe();
  }
  
  isAppEnabled(entry: UserApplicationEntry): boolean {
    const userConfig = entry.appConfigs?.[0]?.configData;
    const defaultConfig = entry.application.defaultConfig;

    if (userConfig && typeof userConfig.userSettings?.enabled === 'boolean') {
      return userConfig.userSettings.enabled;
    }
    if (defaultConfig && typeof defaultConfig.userSettings?.enabled === 'boolean') {
      return defaultConfig.userSettings.enabled;
    }
    return false; // Default to disabled if no setting is found
  }
}