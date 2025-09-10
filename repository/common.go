package repository

import "gorm.io/gorm"

type Repository[T any] struct {
	db *gorm.DB
}

func NewRepository[T any](orm *gorm.DB) *Repository[T] {
	return &Repository[T]{
		db: orm,
	}
}

func (r *Repository[T]) Create(input *T) error {
	return r.db.Create(&input).Error
}

func (r *Repository[T]) Update(input *T, cond *T) error {
	return r.db.Where(cond).Updates(&input).Error
}

func (r *Repository[T]) Delete(input *T) error {
	return r.db.Delete(&input).Error
}

func (r *Repository[T]) Get(input *T) error {
	return r.db.First(&input).Error
}

func (r *Repository[T]) GetAll() ([]T, error) {
	var output []T
	return output, r.db.Find(&output).Error
}
