// vite.config.ts
import { defineConfig } from "file:///D:/VMS-SYSTEM-main/VMS-SYSTEM-main/node_modules/vite/dist/node/index.js";
import react from "file:///D:/VMS-SYSTEM-main/VMS-SYSTEM-main/node_modules/@vitejs/plugin-react/dist/index.js";
import basicSsl from "file:///D:/VMS-SYSTEM-main/VMS-SYSTEM-main/node_modules/@vitejs/plugin-basic-ssl/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "D:\\VMS-SYSTEM-main\\VMS-SYSTEM-main";
var vite_config_default = defineConfig({
  plugins: [react(), basicSsl()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    port: 3e3,
    host: "0.0.0.0",
    // Expose to LAN for mobile access (192.168.x.x)
    strictPort: false,
    watch: {
      ignored: ["**/android/**", "**/dist/**"]
    },
    headers: {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-XSS-Protection": "1; mode=block",
      "Permissions-Policy": "camera=(self), microphone=()"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxWTVMtU1lTVEVNLW1haW5cXFxcVk1TLVNZU1RFTS1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxWTVMtU1lTVEVNLW1haW5cXFxcVk1TLVNZU1RFTS1tYWluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9WTVMtU1lTVEVNLW1haW4vVk1TLVNZU1RFTS1tYWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IGJhc2ljU3NsIGZyb20gJ0B2aXRlanMvcGx1Z2luLWJhc2ljLXNzbCc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBiYXNpY1NzbCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgaG9zdDogJzAuMC4wLjAnLCAvLyBFeHBvc2UgdG8gTEFOIGZvciBtb2JpbGUgYWNjZXNzICgxOTIuMTY4LngueClcbiAgICBzdHJpY3RQb3J0OiBmYWxzZSxcbiAgICB3YXRjaDoge1xuICAgICAgaWdub3JlZDogWycqKi9hbmRyb2lkLyoqJywgJyoqL2Rpc3QvKionXVxuICAgIH0sXG4gICAgaGVhZGVyczoge1xuICAgICAgJ1gtRnJhbWUtT3B0aW9ucyc6ICdERU5ZJyxcbiAgICAgICdYLUNvbnRlbnQtVHlwZS1PcHRpb25zJzogJ25vc25pZmYnLFxuICAgICAgJ1JlZmVycmVyLVBvbGljeSc6ICdzdHJpY3Qtb3JpZ2luLXdoZW4tY3Jvc3Mtb3JpZ2luJyxcbiAgICAgICdYLVhTUy1Qcm90ZWN0aW9uJzogJzE7IG1vZGU9YmxvY2snLFxuICAgICAgJ1Blcm1pc3Npb25zLVBvbGljeSc6ICdjYW1lcmE9KHNlbGYpLCBtaWNyb3Bob25lPSgpJyxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThSLFNBQVMsb0JBQW9CO0FBQzNULE9BQU8sV0FBVztBQUNsQixPQUFPLGNBQWM7QUFDckIsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO0FBQUEsRUFDN0IsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsaUJBQWlCLFlBQVk7QUFBQSxJQUN6QztBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsbUJBQW1CO0FBQUEsTUFDbkIsMEJBQTBCO0FBQUEsTUFDMUIsbUJBQW1CO0FBQUEsTUFDbkIsb0JBQW9CO0FBQUEsTUFDcEIsc0JBQXNCO0FBQUEsSUFDeEI7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
