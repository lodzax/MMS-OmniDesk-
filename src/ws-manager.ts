import { WebSocket } from "ws";

class WSManager {
  private userConnections = new Map<string, WebSocket>();

  addUser(userId: string, ws: WebSocket) {
    this.userConnections.set(userId, ws);
    console.log(`User connected to WS: ${userId}`);
  }

  removeUser(userId: string) {
    this.userConnections.delete(userId);
    console.log(`User disconnected from WS: ${userId}`);
  }

  sendToUser(userId: string, type: string, data: any) {
    const ws = this.userConnections.get(userId);
    if (ws && ws.readyState === 1) { // 1 is OPEN
      ws.send(JSON.stringify({ type, data }));
    }
  }

  broadcast(type: string, data: any, excludeUserId?: string) {
    this.userConnections.forEach((ws, userId) => {
      if (userId !== excludeUserId && ws.readyState === 1) {
        ws.send(JSON.stringify({ type, data }));
      }
    });
  }
}

export const wsManager = new WSManager();
