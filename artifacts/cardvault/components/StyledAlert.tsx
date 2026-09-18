import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'info' | 'success' | 'warning' | 'error';
  icon?: keyof typeof Ionicons.glyphMap;
}

interface AlertContextValue {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextValue>({
  showAlert: () => {},
  hideAlert: () => {},
});

export function useAppAlert() {
  return useContext(AlertContext);
}

// Global reference for direct import replacement without hooks where needed
let globalShowAlert: ((options: AlertOptions) => void) | null = null;

export function showCustomAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: Partial<AlertOptions>,
) {
  if (globalShowAlert) {
    globalShowAlert({
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
      ...options,
    });
  }
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const [currentAlert, setCurrentAlert] = useState<AlertOptions | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.92));

  const showAlert = useCallback(
    (options: AlertOptions) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentAlert(options);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [fadeAnim, scaleAnim],
  );

  const hideAlert = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      scaleAnim.setValue(0.92);
      setCurrentAlert(null);
    });
  }, [fadeAnim, scaleAnim]);

  // Register global accessor
  globalShowAlert = showAlert;

  const buttons =
    currentAlert?.buttons && currentAlert.buttons.length > 0
      ? currentAlert.buttons
      : [{ text: 'OK', style: 'default' as const }];

  // Auto-infer icon & accent color if not explicit
  const isDestructive = buttons.some((b) => b.style === 'destructive');
  const alertType = currentAlert?.type || (isDestructive ? 'error' : 'info');

  const getThemeColor = () => {
    switch (alertType) {
      case 'success':
        return '#10B981';
      case 'warning':
        return '#F59E0B';
      case 'error':
        return '#EF4444';
      default:
        return colors.primary;
    }
  };

  const getThemeIcon = (): keyof typeof Ionicons.glyphMap => {
    if (currentAlert?.icon) return currentAlert.icon;
    switch (alertType) {
      case 'success':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'alert-circle';
      default:
        return 'information-circle';
    }
  };

  const themeColor = getThemeColor();
  const themeIcon = getThemeIcon();

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      <Modal
        visible={!!currentAlert}
        transparent
        animationType="none"
        onRequestClose={hideAlert}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={hideAlert}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                {/* Header Icon Pill */}
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: themeColor + '1E', borderColor: themeColor + '44' },
                  ]}
                >
                  <Ionicons name={themeIcon} size={28} color={themeColor} />
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {currentAlert?.title}
                </Text>

                {/* Message Body */}
                {currentAlert?.message ? (
                  <Text style={[styles.message, { color: colors.mutedForeground }]}>
                    {currentAlert.message}
                  </Text>
                ) : null}

                {/* Action Buttons Row / Stack */}
                <View
                  style={[
                    styles.buttonContainer,
                    buttons.length > 2 && styles.buttonContainerStacked,
                  ]}
                >
                  {buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestruct = btn.style === 'destructive';

                    let btnBg = colors.primary;
                    let btnTextColor = colors.primaryForeground;
                    let btnBorderColor = colors.primary;

                    if (isCancel) {
                      btnBg = colors.background;
                      btnTextColor = colors.foreground;
                      btnBorderColor = colors.border;
                    } else if (isDestruct) {
                      btnBg = '#EF4444';
                      btnTextColor = '#FFFFFF';
                      btnBorderColor = '#EF4444';
                    }

                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          hideAlert();
                          btn.onPress?.();
                        }}
                        style={[
                          styles.btn,
                          buttons.length <= 2 && styles.btnFlex,
                          { backgroundColor: btnBg, borderColor: btnBorderColor },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.btnText, { color: btnTextColor }]}>
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 44, 380),
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  buttonContainerStacked: {
    flexDirection: 'column',
    width: '100%',
  },
  btn: {
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnFlex: {
    flex: 1,
  },
  btnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
