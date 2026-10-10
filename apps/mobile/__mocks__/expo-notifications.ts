const granted = { granted: true, canAskAgain: true, expires: 'never', status: 'granted' };

export const scheduleNotificationAsync = jest.fn(() => Promise.resolve('notification-id'));
export const getPermissionsAsync = jest.fn(() => Promise.resolve(granted));
export const requestPermissionsAsync = jest.fn(() => Promise.resolve(granted));
export const setNotificationHandler = jest.fn();
