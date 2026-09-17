import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlayerService } from '../../services/player.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  private readonly router = inject(Router);
  private readonly playerService = inject(PlayerService);

  readonly nameInput = signal('');

  ngOnInit(): void {
    // If already has a name, go to menu
    if (this.playerService.hasName()) {
      this.router.navigate(['/']);
    }
  }

  canSubmit(): boolean {
    return this.nameInput().trim().length > 0;
  }

  submit(): void {
    const name = this.nameInput().trim();
    if (!name) return;
    this.playerService.saveName(name);
    this.router.navigate(['/']);
  }
}
