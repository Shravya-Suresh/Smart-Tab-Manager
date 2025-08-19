package com.example.tabmanager;

import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class RecommendationController {

    @PostMapping("/recommendation")
    public String getRecommendation(@RequestBody Map<String, Object> data) {
        int clicks = (int) (data.getOrDefault("clickCount", 0));
        int keys = (int) (data.getOrDefault("keyPressCount", 0));
        double scroll = 0.0;
        Object scrollObj = data.get("maxScrollDepth");
        if (scrollObj instanceof Number) {
            scroll = ((Number) scrollObj).doubleValue();
        }

        // Simple logic example:
        if (clicks > 50 || keys > 50 || scroll > 80.0) {
            return "keep";
        } else if (clicks < 5 && keys < 5 && scroll < 10.0) {
            return "close";
        } else {
            return "archive";
        }
    }
}
