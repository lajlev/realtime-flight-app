import { Component, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface Question {
  q: string;
  options: string[];
  /** Index of the correct option. */
  answer: number;
}

interface Confetto {
  id: number;
  emoji: string;
  left: number;
  drift: string;
  rotate: string;
  delay: number;
  duration: number;
  size: number;
}

const CONFETTI_EMOJIS = [
  '✈️', '🛩️', '🛫', '🛬', '☁️', '🌤️', '⛅', '🌍', '🗺️', '🧳', '🎉', '🎊', '⭐', '🛰️',
];

/** AviInfo abbreviation quiz — one random question gates the app. */
const QUESTIONS: Question[] = [
  {
    q: 'What does AIP stand for?',
    options: [
      'Aeronautical Information Package',
      'Aeronautical Information Publication',
      'Airspace Information Protocol',
      'Advanced Instrument Procedure',
    ],
    answer: 1,
  },
  {
    q: 'What is a NOTAM used for?',
    options: [
      'Long-term airport construction planning',
      'Publishing aircraft performance data',
      'Temporary or abnormal flight safety information',
      'Booking airport slots',
    ],
    answer: 2,
  },
  {
    q: 'What is AIXM mainly used to model?',
    options: [
      'Aircraft maintenance logs',
      'Digital aeronautical data such as airspace and procedures',
      'Passenger reservation data',
      'Airline financial reports',
    ],
    answer: 1,
  },
  {
    q: 'IWXXM is a data format for what type of information?',
    options: [
      'Aircraft weight and balance',
      'Airport financial performance',
      'Aviation weather reports such as METAR and TAF',
      'Pilot licensing records',
    ],
    answer: 2,
  },
  {
    q: 'FIXM focuses on exchanging which kind of information?',
    options: [
      'Fuel consumption statistics',
      'Flight and trajectory information such as flight plans',
      'Ground handling schedules',
      'Airline crew rosters',
    ],
    answer: 1,
  },
];

@Component({
  selector: 'app-quiz-gate',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (confetti().length) {
      <div class="confetti-layer">
        @for (c of confetti(); track c.id) {
          <span
            class="confetto"
            [style.left.%]="c.left"
            [style.font-size.px]="c.size"
            [style.animation-delay.s]="c.delay"
            [style.animation-duration.s]="c.duration"
            [style.--drift]="c.drift"
            [style.--rotate]="c.rotate"
            >{{ c.emoji }}</span
          >
        }
      </div>
    }

    <div class="gate" [class.solved]="solved()">
      <div class="card">
        <div class="badge"><mat-icon>lock</mat-icon></div>
        <h1>Pre-flight check</h1>
        <p class="subtitle">Answer correctly to access live traffic around Billund.</p>

        <h2 class="question">{{ question.q }}</h2>

        <div class="options">
          @for (opt of question.options; track $index; let i = $index) {
            <button
              mat-stroked-button
              class="option"
              [class.wrong]="wrongIndex() === i"
              [disabled]="solved()"
              (click)="choose(i)"
            >
              <span class="letter">{{ letters[i] }}</span>
              {{ opt }}
            </button>
          }
        </div>

        @if (solved()) {
          <p class="feedback ok">Cleared for takeoff — loading traffic… 🛫</p>
        } @else if (wrongIndex() !== null) {
          <p class="feedback">Access denied — try again. ✈︎</p>
        }
      </div>
    </div>
  `,
  styleUrl: './quiz-gate.scss',
})
export class QuizGate {
  readonly unlocked = output<void>();

  protected readonly letters = ['a', 'b', 'c', 'd'];
  protected readonly question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  protected readonly wrongIndex = signal<number | null>(null);
  protected readonly solved = signal(false);
  protected readonly confetti = signal<Confetto[]>([]);

  protected choose(i: number): void {
    if (i === this.question.answer) {
      this.solved.set(true);
      this.wrongIndex.set(null);
      this.launchConfetti();
      // Let the celebration play before revealing the app.
      setTimeout(() => this.unlocked.emit(), 1400);
    } else {
      this.wrongIndex.set(i);
    }
  }

  private launchConfetti(): void {
    const pieces: Confetto[] = Array.from({ length: 48 }, (_, id) => ({
      id,
      emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
      left: Math.random() * 100,
      drift: `${(Math.random() * 2 - 1) * 35}vw`,
      rotate: `${Math.random() * 720 - 360}deg`,
      delay: Math.random() * 0.5,
      duration: 1.8 + Math.random() * 1.6,
      size: 18 + Math.random() * 24,
    }));
    this.confetti.set(pieces);
  }
}
