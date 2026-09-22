import React from 'react';
import { FilterState } from '../types';

interface Props {
  filter: FilterState;
  setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
}

const FilterBar: React.FC<Props> = ({ filter, setFilter }) => {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="filter-bar">
      <input
        type="text"
        name="keyword"
        placeholder="Keyword"
        value={filter.keyword}
        onChange={handleChange}
      />
      <input
        type="number"
        name="tier"
        placeholder="Trust Tier"
        value={filter.tier}
        onChange={handleChange}
      />
      <input
        type="number"
        name="startTime"
        placeholder="Start Block"
        value={filter.startTime}
        onChange={handleChange}
      />
      <input
        type="number"
        name="endTime"
        placeholder="End Block"
        value={filter.endTime}
        onChange={handleChange}
      />
    </div>
  );
};

export default FilterBar;
