import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  slides = [
    {
      url: '/assets/Home8.png',
      title: 'A Unified Skill Ecosystem',
      description: 'Empowering organizations to manage, track, and grow employee skills effectively.',
    },
    {
      url: '/assets/Home5.png',
      title: 'Data-Driven Growth Paths',
      description: 'Manage skill levels across multiple roles and departments with precision.',
    },
    {
      url: '/assets/Home6.png',
      title: 'Intelligent Analytics',
      description: 'Track progress with intelligent dashboards and real-time feedback.',
    },
    {
      url: '/assets/Home2.png',
      title: 'Dynamic Skill Assessments',
      description: 'Assess employee skills with dynamic and adaptive evaluation tools.',
    }
  ];

  currentIndex = 0;
  rotationAngle = 0; // New property to control 3D rotation
  slideInterval: any;
  slideDuration = 2000; // Longer duration for a more epic feel

  ngOnInit() {
    this.startAutoSlide();
  }

  ngOnDestroy() {
    this.stopAutoSlide();
  }

  startAutoSlide() {
    this.stopAutoSlide();
    this.slideInterval = setInterval(() => {
      this.nextSlide();
    }, this.slideDuration);
  }

  stopAutoSlide() {
    clearInterval(this.slideInterval);
  }

  private updateCarouselRotation() {
    // For 4 slides, each turn is 90 degrees
    this.rotationAngle = this.currentIndex * -90;
    this.startAutoSlide(); // Reset timer on manual interaction
  }

  nextSlide() {
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.updateCarouselRotation();
  }

  prevSlide() {
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.updateCarouselRotation();
  }

  goToSlide(index: number) {
    this.currentIndex = index;
    this.updateCarouselRotation();
  }
}