import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import useColors from '../../hooks/useColors';

/**
 * Card used by the preview (non-functional) sections: Shop, Services, Amenities.
 * `Icon` lets a caller pass a ready-made element when the glyph isn't an Ionicon.
 */
const PreviewTile = ({ title, description, color, iconName, Icon, onPress }) => {
  const colors = useColors();
  const accent = color || colors.primary;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={onPress ? 0.75 : 1}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={title}
    >
      <View style={[styles.iconChip, { backgroundColor: `${accent}1A`, borderColor: `${accent}33` }]}>
        {iconName ? (
          <Ionicons name={iconName} size={26} color={accent} />
        ) : (
          <View style={styles.customIcon}>{Icon}</View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      {description ? (
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '48%',
    marginBottom: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ece4fb',
    shadowColor: '#7f58e2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 14,
  },
  // Legacy callers pass an 80px icon element; scale it down to chip size.
  customIcon: {
    transform: [{ scale: 0.33 }],
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2f2550',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: '#8d80b5',
    fontWeight: '500',
  },
});

export default PreviewTile;
