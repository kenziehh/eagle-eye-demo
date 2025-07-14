import { Colors } from '@/constants/Colors'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function VerifiedScreen() {
    const router = useRouter()
    return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.light.background }}>
            <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
                <Image source={require('@/assets/images/placeholder.png')} style={{ width: 200, height: 200 }} />
                <View>
                    <Text style={{ fontSize: 28, fontWeight: 'bold', color: Colors.light.primary, textAlign: "center" }}>Identity Verified</Text>
                    <Text style={{ marginTop: 10, maxWidth: 340, textAlign: "center" ,color:"#FBFBFB99"}}>Your face and voice have been successfully verified. You're verified and ready to go!</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/face')} style={{ paddingVertical: 14, paddingHorizontal:50, backgroundColor: Colors.light.primary, borderRadius: 50, width: '100%' }}>
                    <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
                        Re-Demo
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}
