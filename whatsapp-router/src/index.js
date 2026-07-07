export default {
    async fetch(request, env) {
        // Get path from request
        const url = new URL(request.url);
        const path = url.pathname;

        // Validate path
        if (path !== env.PATH_AGENDADO && path !== env.PATH_GUIDO)
            return new Response("Not found", {status: 404});

        // Route to runtime by default
        let targetURL = env.RUNTIME_BASE_URL;

        // Clone request and parse body
        let requestBody;
        try {requestBody = await request.clone().json();}
        catch {/* route to runtime by default */}

        // Check if it's Gui
        if (requestBody?.from === env.PHONE_NUMBER) {
            // Check if ngrok is running
            try {
                const controller = new AbortController();
                const timeoutID = setTimeout(() => controller.abort(), 2000); // 2s
                const ngrokCheck = await fetch(env.NGROK_BASE_URL, {
                    signal: controller.signal, // Any response means the tunnel is reachable - TODO: test
                    headers: {"ngrok-skip-browser-warning": "true"},
                });
                clearTimeout(timeoutID);
                await ngrokCheck.body?.cancel();

                // Route Gui to ngrok
                targetURL = env.NGROK_BASE_URL;

            } catch {
                // If ngrok isn't running or check fails, don't crash
            }
        }

        // Route to destination
        const newRequest = new Request(targetURL + path + url.search, request);
        return fetch(newRequest);
    },
};