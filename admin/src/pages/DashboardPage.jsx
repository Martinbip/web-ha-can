import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';

export default function DashboardPage() {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    apiRequest('/dashboard').then((payload) => setCards(payload.cards || [])).catch(() => setCards([]));
  }, []);

  return (
    <main className="page">
      <div className="page-heading">
        <h1>Dashboard</h1>
        <p>Tổng quan nội dung và yêu cầu mới.</p>
      </div>
      <section className="metric-grid">
        {cards.map((card) => (
          <article className="metric-card" key={card.type}>
            <span>{card.label}</span>
            <strong>{card.count}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
