import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 2,
    backgroundColor: '#f5f1ff',
    height: 240,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  tabsContainer: {
    width: '100%',
    zIndex: 1,
    backgroundColor: '#f5f1ff',
  },
  scrollContainer: {
    paddingTop: '56%',
    paddingBottom: "20%",
    paddingHorizontal: 10,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sdkTestTileRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sdkTestTile: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  // Apple Control Center Quick Action Dock
  actionDockContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#7e56e7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 7,
    borderWidth: 1,
    borderColor: '#e6d9ff',
  },
  actionButtonWrapper: {
    alignItems: 'center',
    width: 56,
  },
  disabledActionButtonWrapper: {
    opacity: 0.42,
  },
  actionButtonIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e6d9ff',
  },
  actionButtonLabel: {
    color: '#5b3fad',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  disabledDeviceTile: {
    opacity: 0.45,
  }
});