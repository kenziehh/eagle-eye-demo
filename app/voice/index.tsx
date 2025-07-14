import { API_KEY, BASE_URL } from '@/libs/env';
import axios from 'axios';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

export default function VoiceDetectionScreen() {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [audioPermission, setAudioPermission] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isVerified, setIsVerified] = useState(true); 
    const [isUploading, setIsUploading] = useState(false);
    
    const router = useRouter();
    const cameraRef = useRef<CameraView>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Request permissions saat component mount
    useEffect(() => {
        const requestPermissions = async () => {
            // Request camera permission
            if (!cameraPermission?.granted) {
                await requestCameraPermission();
            }
            
            // Request audio permission
            try {
                const { status } = await Audio.requestPermissionsAsync();
                setAudioPermission(status === 'granted');
            } catch (error) {
                console.error('Audio permission error:', error);
                setAudioPermission(false);
            }
        };

        requestPermissions();
    }, [cameraPermission]);

    useEffect(() => {
        let loopAnimation: Animated.CompositeAnimation | null = null;
        let progressAnimation: Animated.CompositeAnimation | null = null;

        if (isLoading) {
            progressAnimation = Animated.timing(progressAnim, {
                toValue: 1,
                duration: 6000,
                useNativeDriver: false,
            });

            progressAnimation.start(({ finished }) => {
                if (!finished) {
                    progressAnim.setValue(0);
                }
            });

            loopAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            loopAnimation.start();
        } else {
            progressAnim.stopAnimation();
            pulseAnim.stopAnimation();
            progressAnim.setValue(0);
            pulseAnim.setValue(1);
        }

        return () => {
            progressAnimation?.stop();
            loopAnimation?.stop();
        };
    }, [isLoading]);

    const startRecording = async () => {
        try {
            // Double check audio permission
            if (!audioPermission) {
                const { status } = await Audio.requestPermissionsAsync();
                if (status !== 'granted') {
                    toast.error('Microphone permission denied');
                    return;
                }
                setAudioPermission(true);
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recordingOptions = {
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            };

            console.log('Starting recording with options:', recordingOptions);

            const { recording } = await Audio.Recording.createAsync(recordingOptions);

            setRecording(recording);
            setIsLoading(true);

            setTimeout(() => {
                stopRecording(recording);
            }, 5000);
        } catch (error) {
            console.error('Recording start error:', error);
            toast.error('Failed to start recording');
        }
    };

    const stopRecording = async (rec: Audio.Recording) => {
        try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();

            console.log('[DEBUG] Recording stopped. URI:', uri);
            setRecording(null);
            setIsUploading(true);
            setIsLoading(false);

            if (!uri) {
                console.log('[ERROR] URI is null after recording');
                toast.error('Recording failed: No audio captured');
                return;
            }

            let fileInfo;
            try {
                fileInfo = await FileSystem.getInfoAsync(uri);
                console.log('[DEBUG] File info:', fileInfo);
            } catch (fileErr) {
                console.log('[ERROR] File info error:', fileErr);
                toast.error('Unable to read audio file');
                return;
            }

            if (!fileInfo.exists || fileInfo.size === 0) {
                console.log('[ERROR] Audio file missing or empty:', fileInfo);
                toast.error('Recording failed: Empty audio');
                return;
            }

            const uploadUrl = `${BASE_URL}/detections/detect-audio`;

            const result = await FileSystem.uploadAsync(uploadUrl, uri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                headers: {
                    'x-api-key': API_KEY,
                },
            });

            const data = JSON.parse(result.body);
            console.log('[DEBUG] API response:', data);

            const resultPrediction = data?.detections?.prediction;
            const confidence = data?.detections?.confidence;

            if (resultPrediction === 'real') {
                toast.success(`Voice is original (confidence: ${confidence})`);
                setIsVerified(true);
            } else {
                toast.error(`Voice is deepfake (confidence: ${confidence})`);
                setIsVerified(true);
            }

        } catch (err: any) {
            console.log('[FATAL ERROR] Unexpected error in stopRecording:', err);
            toast.error('Unexpected error occurred while verifying audio');
        } finally {
            setIsUploading(false);
            setIsLoading(false);
        }
    };

    const requestAllPermissions = async () => {
        // Request camera permission
        await requestCameraPermission();
        
        // Request audio permission
        try {
            const { status } = await Audio.requestPermissionsAsync();
            setAudioPermission(status === 'granted');
        } catch (error) {
            console.error('Audio permission error:', error);
            setAudioPermission(false);
        }
    };

    const renderCameraSection = () => {
        if (!cameraPermission?.granted) {
            return (
                <View style={styles.cameraFrame}>
                    <View style={[styles.camera, styles.cameraPlaceholder]}>
                        <Text style={styles.cameraPlaceholderText}>Camera Permission Required</Text>
                    </View>
                    <View style={styles.overlay}>
                        <View style={styles.faceFrame}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.cameraFrame}>
                <CameraView
                    style={styles.camera}
                    facing="front"
                    ref={cameraRef}
                />
                <View style={styles.overlay}>
                    <View style={styles.faceFrame}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                    </View>
                </View>
            </View>
        );
    };

    const bothPermissionsGranted = cameraPermission?.granted && audioPermission;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Voice Detection</Text>
            </View>

            {/* Camera Container */}
            <View style={styles.cameraContainer}>
                {renderCameraSection()}
            </View>

            {/* Status Text */}
            <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>
                    {bothPermissionsGranted
                        ? recording
                            ? 'Recording your voice..'
                            : 'Record your voice'
                        : 'Camera and microphone permission required'}
                </Text>
                <Text style={styles.statusSubtitle}>
                    {bothPermissionsGranted
                        ? 'Please speak clearly to your microphone'
                        : 'Please grant access to use camera and audio detection'}
                </Text>
            </View>

            {/* Progress Bar */}
            {bothPermissionsGranted && (
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progressAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%'],
                                    }),
                                },
                            ]}
                        />
                    </View>
                </View>
            )}

            {/* Button */}
            <View style={styles.buttonContainer}>
                {bothPermissionsGranted ? (
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={startRecording}
                            disabled={isLoading || recording !== null}
                        >
                            <LinearGradient
                                colors={['#8b5cf6', '#A626FF', '#c084fc']}
                                style={styles.captureButtonGradient}
                            >
                                <View style={styles.captureButtonInner} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <TouchableOpacity
                        style={styles.permissionButton}
                        onPress={requestAllPermissions}
                    >
                        <Text style={styles.permissionButtonText}>Grant Permissions</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Next Step Button */}
            {isVerified && (
                <TouchableOpacity
                    style={{
                        position: 'absolute',
                        bottom: 40,
                        right: 20,
                        padding: 10,
                        borderRadius: 10,
                        zIndex: 1000,
                        backgroundColor: '#A626FF',
                    }}
                    onPress={() => router.push('/verified')}
                >
                    <Text style={styles.permissionButtonText}>Next Step</Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#251F4E',
        position: 'relative',
    },
    header: {
        paddingTop: 30,
        paddingBottom: 30,
        alignItems: 'center',
        backgroundColor: '#7322F833',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#A148FF',
        textAlign: 'center',
    },
    cameraContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    cameraFrame: {
        width: width * 0.85,
        height: width * 0.85,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: '#a855f7',
        overflow: 'hidden',
        position: 'relative',
    },
    camera: {
        flex: 1,
    },
    cameraPlaceholder: {
        backgroundColor: '#374151',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraPlaceholderText: {
        color: '#d1d5db',
        fontSize: 16,
        textAlign: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    faceFrame: {
        width: 200,
        height: 200,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#ffffff',
        borderWidth: 3,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    statusContainer: {
        paddingHorizontal: 20,
        paddingVertical: 30,
        alignItems: 'center',
    },
    statusTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#A148FF',
        marginBottom: 8,
    },
    statusSubtitle: {
        fontSize: 16,
        color: '#9ca3af',
        textAlign: 'center',
    },
    progressContainer: {
        paddingHorizontal: 40,
        marginBottom: 40,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#4b5563',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#A148FF',
        borderRadius: 3,
    },
    buttonContainer: {
        alignItems: 'center',
        paddingBottom: 50,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    captureButtonGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#A626FF',
    },
    permissionButton: {
        backgroundColor: '#A626FF',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 10,
    },
    permissionButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});