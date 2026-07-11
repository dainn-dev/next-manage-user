package com.vehiclemanagement.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class TenantStatusConverter implements AttributeConverter<TenantStatus, String> {

    @Override
    public String convertToDatabaseColumn(TenantStatus attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public TenantStatus convertToEntityAttribute(String dbData) {
        return TenantStatus.fromValue(dbData);
    }
}
