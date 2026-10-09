package org.staticcollective.gro.crossing

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.os.Bundle
import android.os.ParcelUuid
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Human-driven prototype: Bluetooth LE beacon/scan for proximity;
 * Android Wi-Fi Direct peer discovery + user-selected group for data.
 * Wi-Fi packets are NOT encrypted/authenticated at this application layer;
 * only the embedded reLATTE crossing is signature verified. No auto-admit.
 */
class MainActivity : Activity() {
    companion object {
        private const val PICK_CROSSING = 2001
        private const val REQUEST_PERMISSIONS = 2002
        private val SERVICE_UUID = UUID.fromString("8fbdefa1-0dc1-4614-962b-21bf0a31d926")
    }

    private val pool=Executors.newCachedThreadPool()
    private lateinit var status: TextView
    private lateinit var peers: LinearLayout
    private var loaded: ByteArray?=null
    private var ownerAddress: InetAddress?=null
    private var connectedAsOwner=false
    private var listening: ServerSocket?=null
    private var scanning=false
    private var advertising=false

    private val wifi by lazy {
        getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager
    }
    private val channel by lazy { wifi.initialize(this,mainLooper,null) }
    private val bluetooth by lazy {
        (getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
    }
    private val scanCallback=object: ScanCallback() {
        override fun onScanResult(callbackType:Int,result:ScanResult) {
            show("Bluetooth GrO beacon: ${result.device.address} (RSSI ${result.rssi}). Choose a Wi-Fi Direct peer separately.")
        }
        override fun onScanFailed(errorCode:Int) { show("BLE scan failed: $errorCode") }
    }
    private val advertiseCallback=object: AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
            advertising=true
            show("Bluetooth GrO discovery beacon active")
        }
        override fun onStartFailure(errorCode:Int) { show("BLE advertiser unavailable: $errorCode") }
    }
    private val receiver=object: BroadcastReceiver() {
        override fun onReceive(context:Context,intent:Intent) {
            when(intent.action) {
                WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                    if (haveNearbyPermissions()) {
                        try {wifi.requestPeers(channel) { list ->renderPeers(list.deviceList.toList())}}
                        catch(e:SecurityException){show("Wi-Fi permission denied")}
                    }
                }
                WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> refreshConnection()
                WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION ->
                    show(if(intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE,0)==
                        WifiP2pManager.WIFI_P2P_STATE_ENABLED) "Wi-Fi Direct ready"
                        else "Wi-Fi Direct unavailable/disabled")
            }
        }
    }

    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        val column=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(28,28,28,28)
        }
        fun title(text:String) {
            column.addView(TextView(this).apply {this.text=text;textSize=19f})
        }
        fun button(text:String,action:()->Unit) {
            column.addView(Button(this).apply {this.text=text;setOnClickListener{action()}})
        }
        title("GrO · CROSSING FIELD 002")
        title("Real Bluetooth discovery · real Wi-Fi Direct transfer")
        button("1. Select signed reLATTE crossing JSON") {
            startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type="*/*"
            },PICK_CROSSING)
        }
        button("2. Allow nearby-device permissions") {requestNearbyPermissions()}
        button("3a. Advertise GrO Bluetooth beacon") {startBeacon()}
        button("3b. Scan Bluetooth GrO beacons") {startScan()}
        button("4. Discover Wi-Fi Direct peers") {discoverWifi()}
        title("Wi-Fi peers (tap to connect)")
        peers=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
        column.addView(peers)
        button("5. Send crossing to connected group owner") {sendCrossing()}
        button("Show verified local inbox") {
            val dir=java.io.File(filesDir,"crossings")
            show("Stored signed crossings: ${dir.listFiles()?.count {it.extension=="json"} ?: 0}. Nothing admitted automatically.")
        }
        status=TextView(this).apply{textSize=14f;text="Not connected. No crossings admitted."}
        column.addView(status)
        setContentView(ScrollView(this).apply{addView(column)})
        requestNearbyPermissions()
    }

    private fun show(message:String) {
        runOnUiThread {
            status.text=message+"\n\n"+status.text.toString().take(1100)
        }
    }
    private fun requiredPermissions():Array<String> = if(Build.VERSION.SDK_INT>=33) {
        arrayOf(
            Manifest.permission.NEARBY_WIFI_DEVICES,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT,
        )
    } else if(Build.VERSION.SDK_INT>=31) {
        arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT,
        )
    } else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
    private fun haveNearbyPermissions():Boolean =
        requiredPermissions().all { checkSelfPermission(it)==PackageManager.PERMISSION_GRANTED }
    private fun requestNearbyPermissions() {
        if (!haveNearbyPermissions()) requestPermissions(requiredPermissions(),REQUEST_PERMISSIONS)
    }
    override fun onRequestPermissionsResult(requestCode:Int,permissions:Array<out String>,results:IntArray) {
        super.onRequestPermissionsResult(requestCode,permissions,results)
        if(requestCode==REQUEST_PERMISSIONS) {
            show(if(haveNearbyPermissions())"Nearby-device permissions granted"
            else "Nearby permissions required; no radio operations performed")
        }
    }
    override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?) {
        super.onActivityResult(requestCode,resultCode,data)
        if(requestCode!=PICK_CROSSING||resultCode!=RESULT_OK)return
        val uri=data?.data?:return
        pool.execute {
            try {
                val stream=contentResolver.openInputStream(uri) ?: error("Cannot read document")
                val buffer=ByteArray(8192)
                val collected=ByteArrayOutputStream()
                stream.use {
                    while(true) {
                        val count=it.read(buffer)
                        if(count<0)break
                        require(collected.size()+count<=256*1024){"Crossing size exceeds 256 KiB"}
                        collected.write(buffer,0,count)
                    }
                }
                val candidate=collected.toByteArray()
                val verified=CrossingVerifier.verify(candidate)
                loaded=candidate
                show("Source signed crossing VERIFIED: ${verified.crossingId}. Size ${candidate.size} bytes. Ready for human-authorized transfer.")
            } catch(e:Exception){loaded=null;show("Selected crossing rejected: ${e.message}")}
        }
    }
    private fun startBeacon() {
        if(!haveNearbyPermissions()){requestNearbyPermissions();return}
        val advertiser=bluetooth?.bluetoothLeAdvertiser
        if(advertiser==null){show("BLE advertising not supported on this phone");return}
        try {
            advertiser.startAdvertising(
                AdvertiseSettings.Builder()
                    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                    .setConnectable(false).setTimeout(0).build(),
                AdvertiseData.Builder()
                    .addServiceUuid(ParcelUuid(SERVICE_UUID))
                    .setIncludeDeviceName(false).build(),
                advertiseCallback,
            )
        }catch(e:Exception){show("BLE advertise failed: ${e.message}")}
    }
    private fun startScan() {
        if(!haveNearbyPermissions()){requestNearbyPermissions();return}
        val scanner=bluetooth?.bluetoothLeScanner
        if(scanner==null){show("BLE scanning unsupported or Bluetooth is off");return}
        try {
            scanner.startScan(
                listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE_UUID)).build()),
                ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),
                scanCallback,
            )
            scanning=true
            show("Scanning for GrO Bluetooth beacons (not pairing automatically)")
        }catch(e:Exception){show("BLE scan failed: ${e.message}")}
    }
    private fun discoverWifi() {
        if(!haveNearbyPermissions()){requestNearbyPermissions();return}
        try {
            wifi.discoverPeers(channel,object: WifiP2pManager.ActionListener {
                override fun onSuccess(){show("Wi-Fi Direct discovery started. Select peer below.")}
                override fun onFailure(reason:Int){show("Wi-Fi Direct discovery failed: $reason")}
            })
        }catch(e:Exception){show("Wi-Fi Direct unavailable: ${e.message}")}
    }
    private fun renderPeers(found:List<WifiP2pDevice>) {
        runOnUiThread {
            peers.removeAllViews()
            for (device in found) {
                peers.addView(Button(this).apply {
                    text="${device.deviceName.ifBlank { "Unnamed phone" }} (${device.deviceAddress})"
                    setOnClickListener { connect(device) }
                })
            }
            if(found.isEmpty())show("No Wi-Fi Direct peers discovered. Enable Wi-Fi and Location services on both phones.")
        }
    }
    private fun connect(device:WifiP2pDevice) {
        if(!haveNearbyPermissions()){requestNearbyPermissions();return}
        try {
            wifi.connect(channel,WifiP2pConfig().apply {deviceAddress=device.deviceAddress},
                object:WifiP2pManager.ActionListener {
                    override fun onSuccess(){show("Connection negotiated; accept peer request on both devices.")}
                    override fun onFailure(reason:Int){show("P2P connect failed: $reason")}
                })
        }catch(e:Exception){show("P2P connect rejected: ${e.message}")}
    }
    private fun refreshConnection() {
        if(!haveNearbyPermissions())return
        try {
            wifi.requestConnectionInfo(channel) { info ->
                if(!info.groupFormed) {
                    connectedAsOwner=false
                    ownerAddress=null
                    listening?.close()
                    listening=null
                    show("Wi-Fi Direct disconnected")
                    return@requestConnectionInfo
                }
                ownerAddress=info.groupOwnerAddress
                connectedAsOwner=info.isGroupOwner
                if(info.isGroupOwner)listenIfOwner()
                show(if(info.isGroupOwner)
                    "Wi-Fi Direct group owner: inbox listening at TCP port ${CrossingWire.PORT}."
                    else "Wi-Fi Direct client connected. Choose Send after verifying the crossing.")
            }
        }catch(e:Exception){show("P2P state error: ${e.message}")}
    }
    private fun listenIfOwner() {
        if(listening!=null)return
        pool.execute {
            try {
                val server=ServerSocket(CrossingWire.PORT)
                listening=server
                server.soTimeout=1000
                show("Local Wi-Fi Direct receiver accepting TCP crossings")
                while(!server.isClosed) {
                    try {
                        server.accept().use {socket ->
                            try {
                                val verified=CrossingWire.receive(this,socket)
                                show("RECEIVED VIA WI-FI: signed ${verified.crossingId}. In private inbox only; not admitted.")
                            }catch(e:Exception){show("Rejected incoming packet: ${e.message}")}
                        }
                    }catch(_:SocketTimeoutException){}
                }
            }catch(e:Exception){show("Cannot listen on Wi-Fi Direct: ${e.message}")}
            finally {listening=null}
        }
    }
    private fun sendCrossing() {
        val payload=loaded
        val target=ownerAddress
        if(payload==null){show("Select a signed crossing first");return}
        if(target==null||connectedAsOwner){
            show("Sender must be the Wi-Fi Direct client; group owner receives. Connect first.")
            return
        }
        pool.execute {
            try {
                Socket(target,CrossingWire.PORT).use {socket->
                    CrossingWire.send(socket,payload)
                }
                show("DELIVERED: TCP receipt confirmed storage only; admission remains local to receiving GrO.")
            }catch(e:Exception){show("Transfer failed: ${e.message}. Select Send again after reconnection.")}
        }
    }
    override fun onStart(){
        super.onStart()
        val filter=IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
        }
        if(Build.VERSION.SDK_INT>=33) registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED)
        else @Suppress("DEPRECATION") registerReceiver(receiver,filter)
    }
    override fun onStop() {
        try {unregisterReceiver(receiver)}catch(_:Exception){}
        super.onStop()
    }
    override fun onDestroy() {
        try {if(scanning)bluetooth?.bluetoothLeScanner?.stopScan(scanCallback)}catch(_:Exception){}
        try {if(advertising)bluetooth?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)}catch(_:Exception){}
        try {listening?.close()}catch(_:Exception){}
        pool.shutdownNow()
        super.onDestroy()
    }
}
