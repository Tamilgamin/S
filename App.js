import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  Switch, TextInput, Alert, Platform, SafeAreaView, StatusBar,
  Dimensions, Animated
} from 'react-native';
import mqtt from 'mqtt/dist/mqtt';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { 
  Thermometer, Settings as SettingsIcon, Bell, BellOff, 
  Wifi, WifiOff, Volume2, ChevronLeft, AlertCircle, Activity 
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// MQTT Configuration
const MQTT_CONFIG = {
  host: '57f9938c484c4f0f9ad4b79b70ae3bf7.s1.eu.hivemq.cloud',
  port: 8884,
  path: '/mqtt',
  protocol: 'wss',
  username: 'qqqqq',
  password: 'Agash2008',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // State
  const [temp, setTemp] = useState(null);
  const [prevTemp, setPrevTemp] = useState(null);
  const [status, setStatus] = useState('OFFLINE');
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  
  // Settings with Thresholds
  const [settings, setSettings] = useState({
    alarmEnabled: true,
    alarmDuration: '30',
    alarmDurationUnit: 'seconds',
    lowThreshold: '25',
    highThreshold: '65'
  });

  // Animation Refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const mqttClient = useRef(null);
  const soundObject = useRef(new Audio.Sound());

  // 1. MQTT & Status Logic
  useEffect(() => {
    const client = mqtt.connect(`wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}${MQTT_CONFIG.path}`, {
      username: MQTT_CONFIG.username,
      password: MQTT_CONFIG.password,
      clientId: `incubator_${Math.random().toString(16).slice(2, 10)}`,
      reconnectPeriod: 5000,
    });

    client.on('connect', () => {
      setIsConnected(true);
      client.subscribe(['incubator/temp']);
    });

    client.on('message', (topic, message) => {
      if (topic === 'incubator/temp') {
        const val = parseFloat(message.toString());
        setPrevTemp(temp);
        setTemp(val);

        // Derive Status Locally
        const low = parseFloat(settings.lowThreshold);
        const high = parseFloat(settings.highThreshold);
        if (val < low) setStatus('LOW');
        else if (val > high) setStatus('HIGH');
        else setStatus('NORMAL');

        // Trigger Pulse Animation
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true })
        ]).start();
      }
    });

    client.on('close', () => setIsConnected(false));
    mqttClient.current = client;
    return () => client.end();
  }, [temp, settings.lowThreshold, settings.highThreshold]);

  // 2. Alarm Trigger
  const triggerAlarm = useCallback(async () => {
    if (!settings.alarmEnabled || isAlarmActive) return;
    setIsAlarmActive(true);
    try {
      await soundObject.current.loadAsync({ uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' });
      await soundObject.current.setIsLoopingAsync(true);
      await soundObject.current.playAsync();
      await Notifications.scheduleNotificationAsync({
        content: { title: "⚠️ INCUBATOR ALERT", body: `Temp: ${temp}°C is out of range!` },
        trigger: null,
      });
    } catch (e) {}

    const duration = parseInt(settings.alarmDuration) * (settings.alarmDurationUnit === 'minutes' ? 60000 : 1000);
    setTimeout(async () => {
      setIsAlarmActive(false);
      await soundObject.current.stopAsync();
      await soundObject.current.unloadAsync();
    }, duration);
  }, [settings, isAlarmActive, temp]);

  useEffect(() => {
    if (temp !== null) {
      const low = parseFloat(settings.lowThreshold);
      const high = parseFloat(settings.highThreshold);
      if (temp < low || temp > high) triggerAlarm();
    }
  }, [temp, triggerAlarm]);

  const getStatusColor = () => {
    if (status === 'HIGH') return '#ef4444';
    if (status === 'LOW') return '#3b82f6';
    return '#10b981';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
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
            <Animated.View style={[styles.tempCircle, { transform: [{ scale: scaleAnim }], borderColor: getStatusColor() + '40' }]}>
              <Text style={styles.tempValue}>{temp !== null ? Math.round(temp) : '--'}</Text>
              <Text style={styles.tempUnit}>°C</Text>
            </Animated.View>

            <View style={[styles.badge, { backgroundColor: getStatusColor() + '20' }]}>
              <Activity size={16} color={getStatusColor()} />
              <Text style={[styles.badgeText, { color: getStatusColor() }]}>{status}</Text>
            </View>

            <View style={styles.limitRow}>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>LOW LIMIT</Text>
                <Text style={styles.limitVal}>{settings.lowThreshold}°C</Text>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>HIGH LIMIT</Text>
                <Text style={styles.limitVal}>{settings.highThreshold}°C</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.settingsView}>
            <Text style={styles.sectionTitle}>THRESHOLD SETTINGS</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <View style={styles.inputHalf}>
                  <Text style={styles.cardSub}>Low Alarm (°C)</Text>
                  <TextInput style={styles.input} value={settings.lowThreshold} onChangeText={(v) => setSettings({...settings, lowThreshold: v})} keyboardType="numeric" />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.cardSub}>High Alarm (°C)</Text>
                  <TextInput style={styles.input} value={settings.highThreshold} onChangeText={(v) => setSettings({...settings, highThreshold: v})} keyboardType="numeric" />
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>ALARM CONFIG</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>Enable Alarm</Text>
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
  tempCircle: { width: width * 0.7, height: width * 0.7, borderRadius: width * 0.35, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  tempValue: { color: '#fff', fontSize: 100, fontWeight: '200' },
  tempUnit: { color: '#52525b', fontSize: 24, fontWeight: 'bold' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 30, gap: 8 },
  badgeText: { fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  limitRow: { flexDirection: 'row', marginTop: 40, gap: 40 },
  limitItem: { alignItems: 'center' },
  limitLabel: { color: '#52525b', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  limitVal: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  settingsView: { paddingTop: 10 },
  sectionTitle: { color: '#52525b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 15 },
  card: { backgroundColor: '#18181b', padding: 20, borderRadius: 24, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#fff', fontWeight: 'bold' },
  cardSub: { color: '#52525b', fontSize: 10, fontWeight: 'bold', marginBottom: 8 },
  inputGroup: { flexDirection: 'row', gap: 15 },
  inputHalf: { flex: 1 },
  input: { backgroundColor: '#09090b', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, borderWeight: 1, borderColor: '#27272a' }
});