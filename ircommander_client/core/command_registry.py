"""
Command Registry - Centralized command handling system
Allows easy registration and execution of commands from the API.
"""

from typing import Dict, Callable, Optional, List
from functools import wraps


class CommandRegistry:
    """Registry for device commands."""
    
    def __init__(self):
        self._handlers: Dict[str, Callable] = {}
        self._descriptions: Dict[str, str] = {}
        self._examples: Dict[str, Dict] = {}
    
    def register(self, command_action: str, handler: Callable, description: str = "", example_params: Dict = None):
        """Register a command handler.
        
        Args:
            command_action: The command action string (e.g., "enter_car")
            handler: Function that takes (params: Dict) and returns Dict with "success" and optional "message"
            description: Human-readable description of what the command does
            example_params: Example command_params JSON for documentation
        """
        self._handlers[command_action] = handler
        if description:
            self._descriptions[command_action] = description
        if example_params:
            self._examples[command_action] = example_params
    
    def execute(self, command_action: str, params: Dict = None) -> Dict:
        """Execute a command.
        
        Args:
            command_action: The command action string
            params: Command parameters (from command_params JSON)
            
        Returns:
            Dict with "success" (bool) and optional "message" (str)
        """
        handler = self._handlers.get(command_action)
        if not handler:
            return {
                "success": False,
                "message": f"Unknown command: {command_action}. Available commands: {', '.join(self.list_commands())}"
            }
        
        try:
            params = params or {}
            result = handler(params)
            # Ensure result has success field
            if not isinstance(result, dict) or "success" not in result:
                return {"success": False, "message": "Handler returned invalid result format"}
            return result
        except Exception as e:
            return {"success": False, "message": f"Command execution error: {str(e)}"}
    
    def list_commands(self) -> List[str]:
        """Get list of registered command actions."""
        return list(self._handlers.keys())
    
    def get_info(self, command_action: str) -> Optional[Dict]:
        """Get information about a command."""
        if command_action not in self._handlers:
            return None
        
        info = {
            "command_action": command_action,
            "registered": True,
        }
        if command_action in self._descriptions:
            info["description"] = self._descriptions[command_action]
        if command_action in self._examples:
            info["example_params"] = self._examples[command_action]
        return info
    
    def get_all_info(self) -> Dict[str, Dict]:
        """Get information about all registered commands."""
        return {cmd: self.get_info(cmd) for cmd in self.list_commands()}


# Global registry instance
_registry: Optional[CommandRegistry] = None


def get_registry() -> CommandRegistry:
    """Get the global command registry."""
    global _registry
    if _registry is None:
        _registry = CommandRegistry()
    return _registry

