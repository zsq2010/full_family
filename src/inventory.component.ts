import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { InventoryItem, InventoryStatus, InventoryCategory } from './types';

@Component({
  selector: 'app-inventory',
  imports: [NgOptimizedImage, ReactiveFormsModule],
  templateUrl: './inventory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryComponent implements OnInit {
  // FIX: Explicitly typing injected services for consistency and to prevent potential type inference errors.
  private authService: AuthService = inject(AuthService);
  private dataService: DataService = inject(DataService);

  loggedInUser = this.authService.currentUser;
  inventory = this.dataService.inventory;

  // --- UI State ---
  isNewItemPanelOpen = signal(false);
  editingItemId = signal<number | null>(null);
  activeInventoryTab = signal<'stock' | 'shopping'>('stock');
  
  // --- Commenting State ---
  commentingOnItemId = signal<number | null>(null);
  newInventoryCommentContent = signal('');

  // --- Forms ---
  newItemForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    category: new FormControl<InventoryCategory>('食材', [Validators.required]),
    image: new FormControl('https://picsum.photos/seed/newitem/200/200'),
    brand: new FormControl(''),
    store: new FormControl(''),
    notes: new FormControl(''),
    usageScenario: new FormControl(''),
  });

  ngOnInit(): void {}

  // --- Computed Signals ---
  groupedInventory = computed(() => {
    return this.inventory()
      .filter(item => item.status === 'IN_STOCK')
      .reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<InventoryCategory, InventoryItem[]>);
  });

  inventoryCategories = computed(() => {
    return Object.keys(this.groupedInventory()) as InventoryCategory[];
  });

  shoppingListItems = computed(() => {
    return this.inventory()
      .filter(item => item.status === 'RUNNING_LOW' || item.status === 'OUT_OF_STOCK')
      .sort((a, b) => {
        if (a.status === 'OUT_OF_STOCK' && b.status === 'RUNNING_LOW') return -1;
        if (a.status === 'RUNNING_LOW' && b.status === 'OUT_OF_STOCK') return 1;
        return 0;
      });
  });

  // --- Panel Management ---
  openNewItemPanel(): void {
    this.isNewItemPanelOpen.set(true);
  }

  openEditItemPanel(item: InventoryItem): void {
    this.editingItemId.set(item.id);
    this.newItemForm.patchValue({
      name: item.name,
      category: item.category,
      image: item.image,
      brand: item.brand ?? '',
      store: item.store ?? '',
      notes: item.notes ?? '',
      usageScenario: item.usageScenario ?? ''
    });
    this.isNewItemPanelOpen.set(true);
  }
  
  closeNewItemPanel(): void {
    this.isNewItemPanelOpen.set(false);
    this.editingItemId.set(null);
    this.newItemForm.reset({
      name: '',
      category: '食材',
      image: `https://picsum.photos/seed/${Date.now()}/200/200`,
      brand: '',
      store: '',
      notes: '',
      usageScenario: '',
    });
  }

  // --- Data Modification Methods ---
  onAddNewItemSubmit(): void {
    if (this.newItemForm.invalid) {
      return;
    }
    const formValue = this.newItemForm.value;
    const itemData = {
      name: formValue.name!,
      category: formValue.category!,
      image: formValue.image || `https://picsum.photos/seed/${formValue.name}/200/200`,
      brand: formValue.brand || undefined,
      store: formValue.store || undefined,
      notes: formValue.notes || undefined,
      usageScenario: formValue.usageScenario || undefined,
    };

    const currentEditingId = this.editingItemId();
    if (currentEditingId) {
        this.dataService.updateInventoryItem(currentEditingId, itemData).subscribe(() => {
            this.closeNewItemPanel();
        });
    } else {
        this.dataService.addInventoryItem(itemData).subscribe(() => {
            this.closeNewItemPanel();
        });
    }
  }

  deleteItem(itemId: number, itemName: string): void {
    if (confirm(`您确定要删除 "${itemName}" 吗？此操作无法撤销。`)) {
      this.dataService.deleteInventoryItem(itemId).subscribe();
    }
  }

  updateItemStatus(itemId: number, status: InventoryStatus): void {
    this.dataService.updateInventoryItemStatus(itemId, status).subscribe();
  }

  markAsPurchased(itemId: number): void {
    this.dataService.updateInventoryItemStatus(itemId, 'IN_STOCK').subscribe();
  }

  toggleInventoryCommentInput(itemId: number): void {
    this.commentingOnItemId.update(currentId => currentId === itemId ? null : itemId);
    this.newInventoryCommentContent.set('');
  }

  onInventoryCommentInput(event: Event): void {
      this.newInventoryCommentContent.set((event.target as HTMLTextAreaElement).value);
  }

  submitInventoryComment(itemId: number): void {
      const currentUser = this.loggedInUser();
      const content = this.newInventoryCommentContent().trim();
      if (!currentUser || !content) return;

      this.dataService.addInventoryComment(itemId, content, currentUser).subscribe(() => {
          this.toggleInventoryCommentInput(itemId);
      });
  }

  deleteInventoryItemComment(itemId: number, commentId: number): void {
    if (confirm('您确定要删除这条评论吗？')) {
        this.dataService.deleteInventoryComment(itemId, commentId).subscribe();
    }
  }

  // --- Template Helpers ---
  getInventoryStatusConfig(status: InventoryStatus) {
    switch (status) {
      case 'IN_STOCK': return { text: '充足', color: 'bg-emerald-500', buttonClasses: 'bg-emerald-100 text-emerald-800' };
      case 'RUNNING_LOW': return { text: '快用完了', color: 'bg-amber-500', buttonClasses: 'bg-amber-100 text-amber-800' };
      case 'OUT_OF_STOCK': return { text: '已用完', color: 'bg-rose-500', buttonClasses: 'bg-rose-100 text-rose-800' };
    }
  }
}