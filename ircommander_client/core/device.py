"""
Device fingerprinting and identification.
"""

import hashlib
import platform
import socket
import subprocess
import uuid
from typing import Optional


def get_fingerprint() -> str:
    """Generate deterministic hardware fingerprint."""
    components = [
        platform.node(),
        platform.system(),
        platform.release(),
        platform.machine(),
        str(uuid.getnode()),
    ]
    
    # Try to get system UUID on Windows
    try:
        output = subprocess.check_output(
            ["wmic", "csproduct", "get", "uuid"],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2
        )
        lines = [l.strip() for l in output.splitlines() if l.strip()]
        if len(lines) >= 2:
            components.append(lines[1])
    except Exception:
        pass
    
    data = "|".join(str(c) for c in components if c)
    return hashlib.sha256(data.encode()).hexdigest()


def get_hostname() -> str:
    """Get machine hostname."""
    return socket.gethostname()


def get_local_ip() -> str:
    """Get local IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_system_info() -> dict:
    """Gather comprehensive system information."""
    import psutil
    import sys
    
    info = {
        "os_name": platform.system(),
        "os_version": platform.release(),
        "os_arch": platform.machine(),
        "hostname": socket.gethostname(),
        "local_ip": get_local_ip(),
    }
    
    # CPU Information
    try:
        info["cpu_count"] = psutil.cpu_count(logical=True)
        info["cpu_cores"] = psutil.cpu_count(logical=False)
        if platform.system() == "Windows":
            try:
                cpu_name = subprocess.check_output(
                    ["wmic", "cpu", "get", "name"],
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=2
                )
                lines = [l.strip() for l in cpu_name.splitlines() if l.strip() and l.strip() != "Name"]
                if lines:
                    info["cpu_name"] = lines[0]
            except Exception:
                info["cpu_name"] = platform.processor() or "Unknown"
        else:
            info["cpu_name"] = platform.processor() or "Unknown"
    except Exception:
        info["cpu_name"] = platform.processor() or "Unknown"
        info["cpu_count"] = None
        info["cpu_cores"] = None
    
    # RAM Information
    try:
        mem = psutil.virtual_memory()
        info["ram_total_gb"] = round(mem.total / (1024**3), 2)
        info["ram_available_gb"] = round(mem.available / (1024**3), 2)
        info["ram_used_percent"] = round(mem.percent, 1)
    except Exception:
        info["ram_total_gb"] = None
        info["ram_available_gb"] = None
        info["ram_used_percent"] = None
    
    # GPU/Graphics Card Information
    try:
        if platform.system() == "Windows":
            gpu_name = None
            # Virtual display adapters to exclude
            virtual_adapters = ['parsec', 'rdp', 'remote desktop', 'virtual', 'vmware', 'virtualbox', 'qemu', 'hyper-v', 'microsoft basic display', 'basic render driver']
            
            # Try PowerShell first (more reliable filtering)
            try:
                ps_cmd = '''
                $gpus = Get-WmiObject Win32_VideoController | Where-Object {
                    $_.Name -ne $null -and 
                    $_.Name -notmatch "Parsec|RDP|Remote Desktop|Virtual|VMware|VirtualBox|QEMU|Hyper-V|Microsoft Basic Display|Basic Render Driver"
                }
                $nvidia = $gpus | Where-Object {$_.Name -match "NVIDIA|GeForce|RTX|GTX"}
                if ($nvidia) { 
                    $nvidia[0].Name 
                } else {
                    $amd = $gpus | Where-Object {$_.Name -match "AMD|Radeon|RX"}
                    if ($amd) { 
                        $amd[0].Name 
                    } else {
                        $intel = $gpus | Where-Object {$_.Name -match "Intel.*Arc"}
                        if ($intel) {
                            $intel[0].Name
                        } else {
                            if ($gpus) { $gpus[0].Name }
                        }
                    }
                }
                '''
                gpu_output = subprocess.check_output(
                    ["powershell", "-Command", ps_cmd],
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=3
                )
                if gpu_output.strip():
                    gpu_name = gpu_output.strip().split('\n')[0].strip()
            except Exception:
                pass
            
            # Fallback: wmic method
            if not gpu_name:
                try:
                    gpu_output = subprocess.check_output(
                        ["wmic", "path", "win32_VideoController", "get", "name"],
                        stderr=subprocess.DEVNULL,
                        text=True,
                        timeout=3
                    )
                    lines = [l.strip() for l in gpu_output.splitlines() if l.strip() and l.strip() != "Name"]
                    
                    if lines:
                        # Filter out virtual adapters
                        real_gpus = [gpu for gpu in lines if not any(virtual in gpu.lower() for virtual in virtual_adapters)]
                        
                        if real_gpus:
                            # Prioritize NVIDIA
                            nvidia_gpus = [gpu for gpu in real_gpus if any(x in gpu.lower() for x in ['nvidia', 'geforce', 'rtx', 'gtx'])]
                            if nvidia_gpus:
                                gpu_name = nvidia_gpus[0]
                            else:
                                # Then AMD
                                amd_gpus = [gpu for gpu in real_gpus if any(x in gpu.lower() for x in ['amd', 'radeon', 'rx'])]
                                if amd_gpus:
                                    gpu_name = amd_gpus[0]
                                else:
                                    # Then Intel Arc
                                    intel_arc = [gpu for gpu in real_gpus if 'intel' in gpu.lower() and 'arc' in gpu.lower()]
                                    if intel_arc:
                                        gpu_name = intel_arc[0]
                                    else:
                                        # Use first real GPU
                                        gpu_name = real_gpus[0]
                        else:
                            # All are virtual, skip them and use None
                            gpu_name = None
                except Exception:
                    pass
            
            info["gpu_name"] = gpu_name
        else:
            # Linux/Mac - try to get GPU info
            try:
                import os
                if os.path.exists("/usr/bin/lspci"):
                    gpu_output = subprocess.check_output(
                        ["lspci", "|", "grep", "-i", "vga"],
                        stderr=subprocess.DEVNULL,
                        text=True,
                        timeout=2,
                        shell=True
                    )
                    if gpu_output.strip():
                        info["gpu_name"] = gpu_output.strip()
                else:
                    info["gpu_name"] = "Unknown"
            except Exception:
                info["gpu_name"] = "Unknown"
    except Exception:
        info["gpu_name"] = None
    
    # Disk/Storage Information
    try:
        disk = psutil.disk_usage('/')
        if platform.system() == "Windows":
            # On Windows, get C: drive
            disk = psutil.disk_usage('C:\\')
        
        info["disk_total_gb"] = round(disk.total / (1024**3), 2)
        info["disk_used_gb"] = round(disk.used / (1024**3), 2)
        info["disk_free_gb"] = round(disk.free / (1024**3), 2)
        info["disk_used_percent"] = round(disk.percent, 1)
        info["disk_low_space"] = disk.percent > 90  # Warning if >90% used
    except Exception:
        info["disk_total_gb"] = None
        info["disk_used_gb"] = None
        info["disk_free_gb"] = None
        info["disk_used_percent"] = None
        info["disk_low_space"] = None
    
    # Service/Process Status Checks
    try:
        if platform.system() == "Windows":
            # Check if iRacing processes are running
            iracing_processes = []
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    proc_name = proc.info['name'].lower()
                    if 'iracing' in proc_name or 'iracingsim' in proc_name:
                        iracing_processes.append(proc.info['name'])
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            info["iracing_process_running"] = len(iracing_processes) > 0
            info["iracing_processes"] = iracing_processes if iracing_processes else None
            
            # Check Windows services (iRacing related)
            try:
                services_output = subprocess.check_output(
                    ["wmic", "service", "where", "name like '%iracing%'", "get", "name,state"],
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=2
                )
                # Parse service status if any found
                info["iracing_services"] = services_output.strip() if services_output.strip() else None
            except Exception:
                info["iracing_services"] = None
        else:
            info["iracing_process_running"] = None
            info["iracing_processes"] = None
            info["iracing_services"] = None
    except Exception:
        info["iracing_process_running"] = None
        info["iracing_processes"] = None
        info["iracing_services"] = None
    
    # Python version
    info["python_version"] = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    
    return info


