"""
Flask API Server for PC Service
Provides local API endpoints for command queuing and status
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import Dict, Optional
import threading
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for web app access

# Global service reference (set by start.py)
_service_instance: Optional[object] = None


def set_service(service):
    """Set the service instance for API endpoints"""
    global _service_instance
    _service_instance = service


@app.route('/api/status', methods=['GET'])
def get_status():
    """Get service status"""
    if not _service_instance:
        return jsonify({'error': 'Service not available'}), 503
    
    try:
        status = _service_instance.get_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/device/<device_id>/commands', methods=['GET'])
def get_commands(device_id: str):
    """Get pending commands for a device (for polling fallback)"""
    if not _service_instance:
        return jsonify({'error': 'Service not available'}), 503
    
    try:
        # Check if device matches
        if _service_instance.device_id != device_id:
            return jsonify({'error': 'Device ID mismatch'}), 403
        
        # Get pending commands from Supabase
        from service import supabase_service
        if not supabase_service:
            return jsonify({'commands': []})
        
        response = supabase_service.table("irc_device_commands") \
            .select("*") \
            .eq("device_id", device_id) \
            .eq("status", "pending") \
            .order("created_at", desc=False) \
            .limit(10) \
            .execute()
        
        commands = response.data if hasattr(response, 'data') else []
        return jsonify({'commands': commands})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/device/<device_id>/commands', methods=['POST'])
def queue_command(device_id: str):
    """Queue a command for a device"""
    if not _service_instance:
        return jsonify({'error': 'Service not available'}), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        command_type = data.get('type', 'control')
        command_action = data.get('action')
        command_params = data.get('params', {})
        
        if not command_action:
            return jsonify({'error': 'Action is required'}), 400
        
        # Insert command into Supabase
        from service import supabase_service
        if not supabase_service:
            return jsonify({'error': 'Database not available'}), 503
        
        command_record = {
            'device_id': device_id,
            'command_type': command_type,
            'command_action': command_action,
            'command_params': command_params,
            'status': 'pending',
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        }
        
        result = supabase_service.table("irc_device_commands") \
            .insert(command_record) \
            .execute()
        
        command_id = None
        if hasattr(result, 'data') and result.data:
            command_id = result.data[0].get('id') if isinstance(result.data, list) else result.data.get('id')
        
        return jsonify({
            'success': True,
            'command_id': command_id,
            'message': f'Command queued: {command_action}'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/device/<device_id>/commands/<command_id>/complete', methods=['POST'])
def complete_command(device_id: str, command_id: str):
    """Mark a command as completed"""
    if not _service_instance:
        return jsonify({'error': 'Service not available'}), 503
    
    try:
        from service import supabase_service
        if not supabase_service:
            return jsonify({'error': 'Database not available'}), 503
        
        supabase_service.table("irc_device_commands") \
            .update({'status': 'completed', 'completed_at': time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')}) \
            .eq('id', command_id) \
            .eq('device_id', device_id) \
            .execute()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def run_server(host='127.0.0.1', port=5000):
    """Run the Flask server"""
    print(f"[*] Starting API server on http://{host}:{port}")
    app.run(host=host, port=port, debug=False, use_reloader=False)

