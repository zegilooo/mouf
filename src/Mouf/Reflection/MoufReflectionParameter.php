<?php
/*
 * This file is part of the Mouf core package.
 *
 * (c) 2012 David Negrier <david@mouf-php.com>
 *
 * For the full copyright and license information, please view the LICENSE.txt
 * file that was distributed with this source code.
 */
namespace Mouf\Reflection;

use Mouf\MoufPropertyDescriptor;

/**
 * Extended Reflection class for parameters.
 * 
 */
use Mouf\MoufException;

class MoufReflectionParameter extends \ReflectionParameter implements MoufReflectionParameterInterface
{
    /**
     * name of reflected routine
     *
     * @var  string
     */
    protected $routineName;
    /**
     * reflection instance of routine containing this parameter
     *
     * @var  stubReflectionRoutine
     */
    protected $refRoutine;
    /**
     * name of reflected parameter
     *
     * @var  string
     */
    protected $paramName;

    /**
     * constructor
     *
     * @param  string|array|MoufReflectionMethod  $routine    name or reflection instance of routine
     * @param  string                              $paramName  name of parameter to reflect
     */
    public function __construct($routine, $paramName)
    {
        if ($routine instanceof MoufReflectionMethod) {
            $this->refRoutine  = $routine;
            $this->routineName = array($routine->getDeclaringClass()->getName(), $routine->getName());
        } /*elseif ($routine instanceof MoufReflectionFunction) {
            $this->refRoutine  = $routine;
            $this->routineName = $routine->getName();
        }*/ else {
            $this->routineName = $routine;
        }
        
        $this->paramName = $paramName;
        parent::__construct($this->routineName, $paramName);
    }
    
    /**
     * helper method to return the reflection routine defining this parameter
     *
     * @return  MoufReflectionMethod
     */
    public function getDeclaringFunction()
    {
        if (null === $this->refRoutine) {
            if (is_array($this->routineName) === true) {
                $this->refRoutine = new MoufReflectionMethod($this->routineName[0], $this->routineName[1]);
            }
        }
        
        return $this->refRoutine;
    }

    /**
     * checks whether a value is equal to the class
     *
     * @param   mixed  $compare
     * @return  bool
     */
    public function equals($compare)
    {
        if (($compare instanceof self) == false) {
            return false;
        }
        
        $class        = $this->getDeclaringClass();
        $compareClass = $compare->getDeclaringClass();
        if ((null == $class && null != $compareClass) || null != $class && null == $compareClass) {
            return false;
        }
        
        if (null == $class) {
            return ($compare->routineName == $this->routineName && $compare->paramName == $this->paramName);
        }
        
        return ($compareClass->getName() == $class->getName() && $compare->routineName == $this->routineName && $compare->paramName == $this->paramName);
    }

    /**
     * returns the class that declares this parameter
     *
     * @return  stubReflectionClass
     */
    public function getDeclaringClass()
    {
        if (is_array($this->routineName) === false) {
            return null;
        }
        
        $refClass     = parent::getDeclaringClass();
        $moufRefClass = new MoufReflectionClass($refClass->getName());
        return $moufRefClass;
    }

    /**
     * returns the type (class) hint for this parameter
     *
     * @return  MoufReflectionClass
     */
    public function getClass()
    {
    	try {
	        $refClass = parent::getClass();
	        if (null === $refClass) {
	            return null;
	        }
    	} catch (\ReflectionException $e) {
    		throw new MoufException("Error while analyzing @param annotation for parameter {$this->paramName} in '{$this->getDeclaringClass()->getName()}::{$this->getDeclaringFunction()->getName()}': ".$e->getMessage(), 0, $e);
    	}
        
        $moufRefClass = new MoufReflectionClass($refClass->getName());
        return $moufRefClass;
    }
    
    /**
    * Returns the class of the parameter (if any)
    *
    * @return string
    */
    public function getType() {
    	if ($this->getClass() != null) {
    		return $this->getClass()->getName();
    	} else {
    		return null;
    	}
    }
    
   	/**
   	 * Appends this property to the XML node passed in parameter.
   	 *
   	 * @param SimpleXmlElement $root The root XML node the property will be appended to.
   	 */
    public function toXml(\SimpleXMLElement $root) {
    	$propertyNode = $root->addChild("parameter");
    	$propertyNode->addAttribute("name", $this->getName());
    	$propertyNode->addAttribute("position", $this->getPosition());
    	$propertyNode->addAttribute("hasDefault", $this->isDefaultValueAvailable()?"true":"false");
    	if ($this->isDefaultValueAvailable()) {
			$propertyNode->addAttribute("default", serialize($this->getDefaultValue())); 
    	}
    	$propertyNode->addAttribute("isArray", $this->isArray()?"true":"false");
    	if ($this->getClass() != null) {
    		$propertyNode->addAttribute("class", $this->getClass()->getName());
    	}
    }
    

    /**
     * Returns a PHP array representing the parameter.
     *
     * @return array
     */
    public function toJson() {
    	$result = array();
    	$result['name'] = $this->getName();
    	$result['hasDefault'] = $this->isDefaultValueAvailable();
    	if ($result['hasDefault']) {
    		$result['default'] = $this->getDefaultValue();
    	}
    	$result['isArray'] = $this->isArray();
    
    	try {
    		// Let's export only the type if we are in a constructor... in order to save time.
    		if ($this->getDeclaringFunction()->isConstructor()) {
    			// TODO: is there a need to instanciate a  MoufPropertyDescriptor?
    			$moufPropertyDescriptor = new MoufPropertyDescriptor($this);
    
    			$result['comment'] = $moufPropertyDescriptor->getDocCommentWithoutAnnotations();
    
    	    	$types = $moufPropertyDescriptor->getTypes();
	    		$result['types'] = $types->toJson();
	    	 
	    		if ($types->getWarningMessage()) {
	    			$result['classinerror'] = $types->getWarningMessage();
	    		}
    			
    			/*if ($moufPropertyDescriptor->isAssociativeArray()) {
    				$result['keytype'] = $moufPropertyDescriptor->getKeyType();
    			}
    			if ($moufPropertyDescriptor->isArray()) {
    				$result['subtype'] = $moufPropertyDescriptor->getSubType();
    			}*/
    		}
    	} catch (\Exception $e) {
    		$result['classinerror'] = $e->getMessage();
    	}
    
    	return $result;
    }
    
}
?>