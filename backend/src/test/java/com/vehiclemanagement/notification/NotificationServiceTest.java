package com.vehiclemanagement.notification;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.assertj.core.api.Assertions.assertThat;

class NotificationServiceTest {
    @Test void disabledPreferenceSuppressesTheChannel() {
        assertThat(NotificationService.preferenceDecision(false,OffsetDateTime.now(),null,null,"UTC"))
                .isEqualTo(NotificationService.PreferenceDecision.DISABLED);
    }

    @Test void defersInsideDaytimeQuietHours() {
        OffsetDateTime now=OffsetDateTime.parse("2026-07-15T13:00:00Z");
        assertThat(NotificationService.quietEnd(now,LocalTime.NOON,LocalTime.of(14,0),"UTC"))
                .isEqualTo(OffsetDateTime.parse("2026-07-15T14:00:00Z"));
    }

    @Test void defersAcrossMidnightInUserTimezone() {
        OffsetDateTime now=OffsetDateTime.parse("2026-07-15T16:30:00Z"); // 23:30 Asia/Saigon
        assertThat(NotificationService.quietEnd(now,LocalTime.of(22,0),LocalTime.of(7,0),"Asia/Ho_Chi_Minh"))
                .isEqualTo(OffsetDateTime.parse("2026-07-16T07:00:00+07:00"));
    }

    @Test void deliversOutsideQuietHours() {
        OffsetDateTime now=OffsetDateTime.parse("2026-07-15T10:00:00Z");
        assertThat(NotificationService.quietEnd(now,LocalTime.of(22,0),LocalTime.of(7,0),"UTC")).isNull();
    }
}
