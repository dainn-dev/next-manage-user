package com.vehiclemanagement.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Invite or link a platform MEMBER to the current tenant (ADR-0603 Phase B).
 * If email already belongs to a MEMBER, links affiliation only (password ignored).
 */
@Data
public class MemberAffiliationInviteRequest {

    @NotBlank
    @Email
    private String email;

    /** Required when creating a new MEMBER; ignored when linking an existing one. */
    @Size(min = 3, max = 50)
    private String username;

    @Size(min = 6, max = 100)
    private String password;

    private String firstName;
    private String lastName;
}
