# Position Hierarchy System - Demo Guide

## Overview
The system now supports a hierarchical military position structure with hover menus for "Sĩ Quan" (Officers) and "QNCN" (Non-commissioned Officers).

## Hierarchy Structure

### Sĩ Quan (Officers)
- **Trung đội** (Platoon)
- **Đại đội** (Company) 
- **Tiểu đoàn** (Battalion)
- **Trung đoàn** (Regiment)
- **Cơ quan** (Headquarters)

### QNCN (Non-commissioned Officers)
- **Tiểu đoàn** (Battalion)
- **Cơ quan** (Headquarters)
  - **Tham mưu** (Staff)
  - **Chính trị** (Political)
  - **Hậu cần - Kỹ thuật** (Logistics - Technical)

## Features Implemented

### 1. Backend Changes
- ✅ Updated `PositionLevel` enum in `Position.java` with military hierarchy levels
- ✅ Added helper methods `isSiQuan()` and `isQNCN()` for level classification
- ✅ Created database migration `V20__seed_position_hierarchy.sql` to populate initial data

### 2. Frontend Changes
- ✅ Created `PositionHierarchyMenu` component with hover functionality
- ✅ Updated position form to use hierarchical selection menu
- ✅ Enhanced position table to display military levels with appropriate badges
- ✅ Updated TypeScript types to match new enum structure

### 3. Hover Menu Functionality
- **Hover over "Sĩ Quan"**: Shows list (Trung đội, Đại đội, Tiểu đoàn, Trung đoàn, Cơ quan)
- **Hover over "QNCN"**: Shows Tiểu đoàn, Cơ quan
  - **Hover over "Cơ quan"**: Shows submenu (Tham mưu, Chính trị, Hậu cần - Kỹ thuật)

## How to Test

1. **Start the application**:
   ```bash
   # Backend
   cd backend
   ./mvnw spring-boot:run

   # Frontend  
   cd ..
   npm run dev
   ```

2. **Navigate to Positions page**: `/positions`

3. **Create new position**:
   - Click "Thêm chức vụ mới"
   - Click on "Cấp độ chức vụ" dropdown
   - Hover over "Sĩ Quan" or "QNCN" to see hierarchical menus
   - Select desired position level

4. **View position hierarchy**:
   - Positions are displayed with color-coded badges:
     - **Red**: Sĩ Quan levels
     - **Blue**: QNCN levels  
     - **Green**: Specialized departments (Tham mưu, Chính trị, etc.)
     - **Orange**: Battalion/Regiment levels

## Database Structure
The positions table now contains:
- Root positions: "Sĩ Quan", "QNCN"
- Child positions with proper parent-child relationships
- Salary ranges appropriate for each level
- Display order for proper hierarchy visualization

## Technical Implementation
- **Hover Detection**: CSS-based hover states with absolute positioning
- **Menu Nesting**: Multi-level dropdown menus with proper z-indexing
- **State Management**: React useState for menu visibility control
- **Type Safety**: Full TypeScript support for position levels
- **Database Integrity**: Foreign key relationships maintain hierarchy consistency
