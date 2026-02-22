import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Switch, TextInput, SafeAreaView, StatusBar, Dimensions, 
  Animated, Easing 
} from 'react-native';
import mqtt from 'mqtt/dist/mqtt';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { 
  Thermometer, Settings as SettingsIcon, Bell, BellOff, 
  Wifi, WifiOff, Volume2, ChevronLeft, AlertCircle, Activity 
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function App() {
  // State matching the preview
  const [temp, setTemp] = useState(null);
  const [prevTemp, setPrevTemp] = useState(null);
  const [status, setStatus] = useState('OFFLINE');
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [settings, setSettings] = useState({
    alarmEnabled: true,
    alarmDuration: '30',
    alarmDurationUnit: 'seconds',
    lowThreshold: '25',
    highThreshold: '65'
  });

  // Animation Refs for the "Preview Feel"
  const springAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  
  const mqttClient = useRef(null);
  const sound = useRef(new Audio.Sound());

  // 1. Breathing Glow Animation (Looping)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // 2. MQTT Logic
  useEffect(() => {
    const client = mqtt.connect('wss://57f9938c484c4f0f9ad4b79b70ae3bf7.s1.eu.hivemq.cloud:8884/mqtt', {
      username: 'qqqqq', password: 'Agash2008', clientId: `app_${Math.random().toString(16).substring(2, 10)}`
    });

    client.on('connect', () => {
      setIsConnected(true);
      client.subscribe(['incubator/temp']);
    });

    client.on('message', (t, m) => {
      if (t === 'incubator/temp') {
        const val = parseFloat(m.toString());
        setPrevTemp(temp);
        setTemp(val);

        // Update Status Locally
        if (val < parseFloat(settings.lowThreshold)) setStatus('LOW');
        else if (val > parseFloat(settings.highThreshold)) setStatus('HIGH');
        else setStatus('NORMAL');

        // Spring Animation for the Number
        Animated.sequence([
          Animated.spring(springAnim, { toValue: 1.1, friction: 3, tension: 40, useNativeDriver: true }),
          Animated.spring(springAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
        ]).start();

        // Update Pulse
        pulseAnim.setValue(0);
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }
    });

    mqttClient.current = client;
    return () => client.end();
  }, [temp, settings]);

  const getStatusColor = () => {
    if (status === 'HIGH') return '#ef4444';
    if (status === 'LOW') return '#3b82f6';
    return '#10b981';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
          <Text style={styles.headerTitle}>Incubator Monitor</Text>
        </View>
        <TouchableOpacity onPress={() => setActiveTab(activeTab === 'home' ? 'settings' : 'home')}>
          {activeTab === 'home' ? <SettingsIcon color="#71717a" size={24} /> : <ChevronLeft color="#71717a" size={24} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'home' ? (
          <View style={styles.monitorView}>
            {/* Animated Background Glow */}
            <Animated.View style={[styles.glow, { 
              backgroundColor: getStatusColor(),
              opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.15] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }]
            }]} />

            {/* Temperature Display */}
            <Animated.View style={[styles.tempCircle, { transform: [{ scale: springAnim }], borderColor: getStatusColor() + '30' }]}>
              <Text style={styles.tempValue}>{temp !== null ? Math.round(temp) : '--'}</Text>
              <Text style={styles.tempUnit}>°C</Text>
              
              {/* Update Pulse Ring */}
              <Animated.View style={[styles.pulseRing, { 
                borderColor: getStatusColor(),
                opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.5] }) }]
              }]} />
            </Animated.View>

            {/* Status Badge (Curved Box) */}
            <View style={[styles.badge, { backgroundColor: getStatusColor() + '15' }]}>
              <Activity size={16} color={getStatusColor()} />
              <Text style={[styles.badgeText, { color: getStatusColor() }]}>{status}</Text>
            </View>

            {/* Threshold Limits (Curved Boxes) */}
            <View style={styles.limitRow}>
              <View style={styles.limitCard}>
                <Text style={styles.limitLabel}>LOW LIMIT</Text>
                <Text style={[styles.limitVal, { color: '#3b82f6' }]}>{settings.lowThreshold}°C</Text>
              </View>
              <View style={styles.limitCard}>
                <Text style={styles.limitLabel}>HIGH LIMIT</Text>
                <Text style={[styles.limitVal, { color: '#ef4444' }]}>{settings.highThreshold}°C</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.settingsView}>
            <Text style={styles.sectionTitle}>THRESHOLD CONFIG</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Low Alarm (°C)</Text>
                  <TextInput style={styles.input} value={settings.lowThreshold} onChangeText={(v) => setSettings({...settings, lowThreshold: v})} keyboardType="numeric" />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>High Alarm (°C)</Text>
                  <TextInput style={styles.input} value={settings.highThreshold} onChangeText={(v) => setSettings({...settings, highThreshold: v})} keyboardType="numeric" />
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>ALARM SYSTEM</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.cardTitle}>Master Alarm</Text>
                  <Text style={styles.cardSub}>Sound & Notifications</Text>
                </View>
                <Switch value={settings.alarmEnabled} onValueChange={(v) => setSettings({...settings, alarmEnabled: v})} trackColor={{ true: '#10b981' }} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#18181b' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  scrollContent: { padding: 20 },
  monitorView: { alignItems: 'center', paddingTop: 40 },
  glow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: 40 },
  tempCircle: { width: width * 0.75, height: width * 0.75, borderRadius: width * 0.375, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff03' },
  tempValue: { color: '#fff', fontSize: 110, fontWeight: '200', letterSpacing: -5 },
  tempUnit: { color: '#52525b', fontSize: 24, fontWeight: 'bold', marginTop: -10 },
  pulseRing: { position: 'absolute', width: '100%', height: '100%', borderRadius: width * 0.375, borderWidth: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 32, marginTop: 40, gap: 8 },
  badgeText: { fontWeight: 'bold', fontSize: 12, letterSpacing: 2 },
  limitRow: { flexDirection: 'row', marginTop: 40, gap: 15, width: '100%' },
  limitCard: { flex: 1, backgroundColor: '#18181b', padding: 20, borderRadius: 32, alignItems: 'center', borderWeight: 1, borderColor: '#27272a' },
  limitLabel: { color: '#52525b', fontSize: 10, fontWeight: 'bold', marginBottom: 5, letterSpacing: 1 },
  limitVal: { fontSize: 18, fontWeight: 'bold' },
  settingsView: { paddingTop: 10 },
  sectionTitle: { color: '#52525b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 15 },
  card: { backgroundColor: '#18181b', padding: 24, borderRadius: 32, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cardSub: { color: '#52525b', fontSize: 12, marginTop: 2 },
  inputGroup: { flexDirection: 'row', gap: 15 },
  inputHalf: { flex: 1 },
  inputLabel: { color: '#52525b', fontSize: 10, fontWeight: 'bold', marginBottom: 10 },
  input: { backgroundColor: '#09090b', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#27272a' }
});