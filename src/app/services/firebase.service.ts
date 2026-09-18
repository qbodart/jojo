import { Injectable } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBoqTHiQpIubOWJp8HAGLuE52x69rqa-y0',
  authDomain: 'jojo-tafels.firebaseapp.com',
  projectId: 'jojo-tafels',
  storageBucket: 'jojo-tafels.firebasestorage.app',
  messagingSenderId: '205459382648',
  appId: '1:205459382648:web:b6cf0ad68e77eb8859e88d',
  measurementId: 'G-TW9ZYZK0EE',
};

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private app: FirebaseApp;
  private analytics: Analytics | null = null;

  constructor() {
    this.app = initializeApp(firebaseConfig);
    // Analytics only works in the browser (not during SSR/prerendering)
    if (typeof window !== 'undefined') {
      this.analytics = getAnalytics(this.app);
    }
  }
}
