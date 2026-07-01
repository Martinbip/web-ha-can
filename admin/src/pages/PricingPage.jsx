import React from 'react';
import { Link } from 'react-router-dom';

const CARDS = [
  {
    type: 'pricing-packages',
    title: 'Giá kim loại',
    description: 'Quản lý bảng giá kim loại theo thị trường (LME, giá nội địa).',
  },
  {
    type: 'pricing-analyses',
    title: 'Biểu phí phân tích',
    description: 'Quản lý biểu phí các hạng mục phân tích kỹ thuật.',
  },
  {
    type: 'pricing-surveys',
    title: 'Biểu phí khảo sát',
    description: 'Quản lý biểu phí các dịch vụ khảo sát.',
  },
];

export default function PricingPage() {
  return (
    <main className="page">
      <div className="page-heading">
        <h1>Bảng giá</h1>
        <p>Quản lý giá kim loại, biểu phí phân tích và khảo sát.</p>
      </div>

      <section className="card-grid">
        {CARDS.map((card) => (
          <article className="card" key={card.type}>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <Link className="btn-primary" to={`/resources/${card.type}`}>
              Quản lý {card.type}
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
