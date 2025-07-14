import { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { CameraView, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { API_KEY, BASE_URL } from '@/libs/env';
import axios from 'axios';
import { toast } from 'sonner-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';


const { width } = Dimensions.get('window');

export default function FaceDetectionScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [isLoading, setIsLoading] = useState(false);
    const [isVerified, setIsVerified] = useState(true);
    const cameraRef = useRef<CameraView>(null);
    const router = useRouter();
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission]);

    useEffect(() => {
        let loopAnimation: Animated.CompositeAnimation | null = null;
        let progressAnimation: Animated.CompositeAnimation | null = null;

        if (isLoading) {
            progressAnimation = Animated.timing(progressAnim, {
                toValue: 1,
                duration: 7000,
                useNativeDriver: false,
            });

            progressAnimation.start(({ finished }) => {
                // Cegah progress bar penuh jika loading dihentikan lebih cepat
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
            // Stop all animations and reset values
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


    const handleCapture = async () => {
        if (!cameraRef.current) return;

        setIsLoading(true);

        try {
            const photo = await cameraRef.current.takePictureAsync() as CameraCapturedPicture;

            const uri = photo?.uri;
            if (!uri) {
                toast.error('Gagal mengambil foto');
                setIsLoading(false);
                return;
            }

            // Cek apakah file-nya ada
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (!fileInfo.exists || fileInfo.size === 0) {
                toast.error('File foto tidak valid atau kosong');
                setIsLoading(false);
                return;
            }

            // Gunakan uploadAsync dari FileSystem (lebih stabil di Android)
            const uploadUrl = `${BASE_URL}/detections/detect-image`;
            const result = await FileSystem.uploadAsync(uploadUrl, uri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                headers: {
                    'x-api-key': API_KEY,
                },
            });

            const data = JSON.parse(result.body);
            const detection = data?.detections;

            if (!detection) {
                toast.error('Response tidak valid dari server');
                console.log('RESPONSE:', data);
                setIsLoading(false);
                return;
            }

            const { prediction, confidence } = detection;

            if (prediction === 'real') {
                toast.success(`Wajah terdeteksi asli (${confidence})`);
                setIsVerified(true);
            } else {
                toast.error(`Wajah terdeteksi deepfake (${confidence})`);
            }

        } catch (error) {
            console.log('ERROR saat deteksi wajah:', error);
            toast.error('Terjadi kesalahan saat mendeteksi wajah');
        }

        setIsLoading(false);
    };
    const renderCameraSection = () => {
        if (!permission?.granted) {
            return (
                <View style={styles.cameraFrame}>
                    <View style={[styles.camera, styles.cameraPlaceholder]}>
                        <Text style={styles.cameraPlaceholderText}>Camera Unavailable</Text>
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

    return (
        <SafeAreaView
            style={styles.container}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Face Detection</Text>
            </View>

            {/* Camera Container */}
            <View style={styles.cameraContainer}>{renderCameraSection()}</View>

            {/* Status Text */}
            <View style={styles.statusContainer}>
                <Text style={styles.statusTitle}>
                    {permission?.granted
                        ? isLoading
                            ? 'Scanning your face..'
                            : 'Position your face'
                        : 'Camera permission required'}
                </Text>
                <Text style={styles.statusSubtitle}>
                    {permission?.granted
                        ? 'Please keep your face centered on the screen'
                        : 'Please grant access to use face detection'}
                </Text>
            </View>

            {/* Progress Bar */}
            {permission?.granted && (
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
                {permission?.granted ? (
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={handleCapture}
                            disabled={isLoading}
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
                        onPress={requestPermission}
                    >
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                )}
            </View>
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
                    onPress={
                        () => router.push('/voice')
                    }

                >
                    <Text style={styles.permissionButtonText}>Next Step</Text>
                </TouchableOpacity>
            )}

            <View style={styles.decorativeElements}>
                <Image
                    source={require('@/assets/images/ellipse-left.png')}
                    style={styles.circuitLeft}
                />
                <Image
                    source={require('@/assets/images/usb-bottom.png')}
                    style={styles.circuitLeft}
                />
            </View>
            {

            }
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
        paddingTop: 60,
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
    decorativeElements: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    circuitLeft: {
        position: 'absolute',
        bottom: 20,
        left: 0,

        zIndex: 1000,
    },
    circuitRight: {
        position: 'absolute',
        bottom: 40,
        right: 30,
        zIndex: 1000,
    },
});
