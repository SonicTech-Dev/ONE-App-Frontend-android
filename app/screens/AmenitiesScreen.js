import React from 'react';
import PreviewSection from '../components/Preview/PreviewSection';

const AMENITY_CATEGORIES = [
  { id: 1, name: 'Fitness Center', description: 'Access our state-of-the-art gym and fitness classes.', iconName: 'fitness', color: '#32d2d6' },
  { id: 2, name: 'Swimming Pool', description: 'Enjoy a relaxing swim in our well-maintained pool.', iconName: 'water', color: '#1e90ff' },
  { id: 3, name: 'Library', description: 'Borrow books or enjoy a quiet space to study.', iconName: 'book', color: '#ffa500' },
  { id: 4, name: 'Lounge Area', description: 'Relax or socialize in our comfortable lounge.', iconName: 'wine', color: '#8e44ad' },
  { id: 5, name: 'Community Events', description: 'Discover social gatherings, fitness classes, and more.', iconName: 'calendar', color: '#ff6347' },
  { id: 6, name: 'Workshops', description: 'Join skill-building workshops and learn something new.', iconName: 'hammer', color: '#f39c12' },
  { id: 7, name: 'Movie Nights', description: 'Watch movies with friends and neighbors in our screening room.', iconName: 'film', color: '#34495e' },
  { id: 8, name: 'Holiday Celebrations', description: 'Celebrate holidays with festive community events.', iconName: 'gift', color: '#e74c3c' },
  { id: 9, name: 'Resident Handbook', description: 'Access guidelines and important information for residents.', iconName: 'document-text', color: '#3498db' },
  { id: 10, name: 'Emergency Contacts', description: 'Quickly access emergency numbers and contacts.', iconName: 'alert-circle', color: '#e74c3c' },
  { id: 11, name: 'Parks & Trails', description: 'Explore nearby parks and walking trails.', iconName: 'leaf', color: '#228b22' },
  { id: 12, name: 'Restaurants & Cafes', description: 'Find popular dining spots and cozy cafes near you.', iconName: 'restaurant', color: '#dc143c' },
  { id: 13, name: 'Shopping Centers', description: 'Discover nearby malls and shopping areas.', iconName: 'bag-handle', color: '#f1c40f' },
];

export default function AmenitiesScreen() {
  return (
    <PreviewSection
      title="Amenities"
      subtitle="A preview of community amenities, events and resources. Booking and details are not yet live."
      items={AMENITY_CATEGORIES}
    />
  );
}
