import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comments.component.html',
})
export class CommentsComponent {
  comments = [
    { time: '1:23', text: 'Verstappen sets the fastest lap!' },
    { time: '1:25', text: 'Hamilton is pitting for new tires.' },
    { time: '1:28', text: 'Leclerc overtakes Perez for P3.' },
  ];
}
