import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Switch, TextInput, SafeAreaView, StatusBar, Dimensions,
  Animated, Easing
} from 'react-native';
import mqtt from 'mqtt';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';
import {
  Settings as SettingsIcon, ChevronLeft, Activity
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const MQTT_URL = "wss://57f9938c484c4f0f9ad4b79b70ae3bf7.s1.eu.hivemq.cloud:8884/mqtt";

export default function App() {
  useKeepAwake(); // 🔋 prevent sleep

  const [temp, setTemp] = useState(null);
  const [status, setStatus] = useState('OFFLINE');
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const [settings, setSettings] = useState({
    alarmEnabled: true,
    lowThreshold: '25',
    highThreshold: '65'
  });

  const springAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const soundRef = useRef(null);

  // 🔔 Notification handler
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  // 🌟 Glow animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // 📡 MQTT connection
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      username: 'qqqqq',
      password: 'Agash2008',
      reconnectPeriod: 5000,
    });

    client.on('connect', () => {
      setIsConnected(true);
      client.subscribe('incubator/temp');
    });

    client.on('message', (topic, message) => {
      const val = parseFloat(message.toString());
      setTemp(val);

      let newStatus = 'NORMAL';
      if (val < parseFloat(settings.lowThreshold)) newStatus = 'LOW';
      if (val > parseFloat(settings.highThreshold)) newStatus = 'HIGH';
      setStatus(newStatus);

      // Animate temperature
      Animated.sequence([
        Animated.spring(springAnim, { toValue: 1.1, useNativeDriver: true }),
        Animated.spring(springAnim, { toValue: 1, useNativeDriver: true })
      ]).start();

      pulseAnim.setValue(0);
      Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

      // 🔔 Alarm trigger
      if (settings.alarmEnabled && (newStatus === 'LOW' || newStatus === 'HIGH')) {
        triggerAlarm(newStatus);
      }
    });

    client.on('error', () => setIsConnected(false));

    return () => client.end();
  }, []);

  // 🔔 Alarm function
  const triggerAlarm = async (state) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Incubator Alert 🚨",
          body: `Temperature is ${state}`,
        },
        trigger: null,
      });

      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
          { shouldPlay: true }
        );
        soundRef.current = sound;
      } else {
        await soundRef.current.replayAsync();
      }
    } catch (e) {
      console.log("Alarm error:", e);
    }
  };

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
          {activeTab === 'home'
            ? <SettingsIcon color="#71717a" size={24} />
            : <ChevronLeft color="#71717a" size={24} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.monitorView}>
          {/* Glow */}
          <Animated.View style={[styles.glow, {
            backgroundColor: getStatusColor(),
            opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.15] }),
            transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }]
          }]} />

          {/* Temperature Circle */}
          <Animated.View style={[styles.tempCircle, { transform: [{ scale: springAnim }] }]}>
            <Text style={styles.tempValue}>{temp !== null ? Math.round(temp) : '--'}</Text>
            <Text style={styles.tempUnit}>°C</Text>
          </Animated.View>

          {/* Status Badge */}
          <View style={[styles.badge, { backgroundColor: getStatusColor() + '15' }]}>
            <Activity size={16} color={getStatusColor()} />
            <Text style={[styles.badgeText, { color: getStatusColor() }]}>{status}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ✅ YOUR FULL STYLES (UNCHANGED) */
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
