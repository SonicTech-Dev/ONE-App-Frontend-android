import React from 'react';
import PreviewSection from '../components/Preview/PreviewSection';

const SHOP_CATEGORIES = [
  { id: 1, name: 'Restaurants', description: 'Order delicious meals from top restaurants.', iconName: 'restaurant', color: '#dc143c' },
  { id: 2, name: 'Supermarket', description: 'Shop for groceries, fresh produce, and essentials.', iconName: 'cart', color: '#f1c40f' },
  { id: 3, name: 'Cafes & Bakeries', description: 'Get your favorite coffee, pastries, and snacks.', iconName: 'cafe', color: '#8e44ad' },
  { id: 4, name: 'Pharmacy', description: 'Order medicines and health essentials.', iconName: 'medkit', color: '#e74c3c' },
  { id: 5, name: 'Beauty & Personal Care', description: 'Shop for skincare, cosmetics, and grooming essentials.', iconName: 'sparkles', color: '#ff69b4' },
  { id: 6, name: 'Home & Kitchen', description: 'Buy home appliances, decor, and kitchen essentials.', iconName: 'home', color: '#3498db' },
  { id: 7, name: 'Electronics', description: 'Get the latest gadgets and accessories.', iconName: 'phone-portrait', color: '#2ecc71' },
  { id: 8, name: 'Fashion & Accessories', description: 'Shop for clothing, shoes, and accessories.', iconName: 'shirt', color: '#ff8c00' },
  { id: 9, name: 'Watches & Jewelry', description: 'Discover luxury watches and stylish jewelry.', iconName: 'watch', color: '#d4af37' },
  { id: 10, name: 'Flowers & Gifts', description: 'Send flowers and gifts for special occasions.', iconName: 'gift', color: '#ff6347' },
  { id: 11, name: 'Pet Supplies', description: 'Order pet food, accessories, and care products.', iconName: 'paw', color: '#a0522d' },
];

export default function ShopScreen() {
  return (
    <PreviewSection
      title="Shop"
      subtitle="A preview of the marketplace coming to your residence. Categories are illustrative and not yet orderable."
      items={SHOP_CATEGORIES}
    />
  );
}
