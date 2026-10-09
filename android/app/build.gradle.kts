plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "org.staticcollective.gro.crossing"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.staticcollective.gro.crossing"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.0.2"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("io.github.erdtman:java-json-canonicalization:1.1")
    testImplementation("junit:junit:4.13.2")
}
