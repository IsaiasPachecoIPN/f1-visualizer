import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { RaceCommentaryService, RaceComment } from '../../services/race-commentary.service';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comments.component.html',
  styles: [`
    .comments-container {
      max-height: 200px;
      overflow-y: auto;
      padding: 10px;
    }

    .comment-item {
      padding: 8px 12px;
      margin-bottom: 8px;
      border-radius: 6px;
      border-left: 4px solid #ccc;
      background: #f8f9fa;
      animation: slideIn 0.3s ease-out;
    }

    .comment-item.overtake {
      border-left-color: #28a745;
      background: #d4edda;
    }

    .comment-item.position {
      border-left-color: #ffc107;
      background: #fff3cd;
    }

    .comment-item.info {
      border-left-color: #17a2b8;
      background: #d1ecf1;
    }

    .comment-time {
      font-size: 12px;
      color: #666;
      font-weight: bold;
      margin-bottom: 4px;
    }

    .comment-text {
      font-size: 14px;
      color: #333;
      margin: 0;
    }

    .no-comments {
      text-align: center;
      color: #999;
      font-style: italic;
      padding: 20px;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .comments-container::-webkit-scrollbar {
      width: 6px;
    }

    .comments-container::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }

    .comments-container::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }

    .comments-container::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
  `]
})
export class CommentsComponent implements OnInit {
  comments$: Observable<RaceComment[]>;

  constructor(private raceCommentaryService: RaceCommentaryService) {
    this.comments$ = this.raceCommentaryService.comments$;
  }

  ngOnInit(): void {
    // Trigger data loading when component initializes
    console.log('💬 Comments component initializing...');
    this.raceCommentaryService.loadData();
  }

  getCommentClass(comment: RaceComment): string {
    return `comment-item ${comment.type}`;
  }

  trackByComment(index: number, comment: RaceComment): string {
    return comment.id;
  }
}
