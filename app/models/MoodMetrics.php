<?php

namespace app\models;

class MoodMetrics extends \li3_fieldwork\extensions\data\Model {

    public static function currentMood() {
        return MoodMetrics::first(['order' => ['created' => 'DESC']]);
    }
	
    public function moodAsString($entity) {
        return 'happy';
    }

}

?>